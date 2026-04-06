from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from parsingEngine import Parser
from evaluator import PolicyEvaluator
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import httpx
import os
from dotenv import load_dotenv

app = FastAPI(title="Policy-Shield API")
security = HTTPBearer()
load_dotenv()

raw_origins = os.getenv("CORS_ALLOWED_ORIGINS", "http://localhost:5173")
origins = [origin.strip() for origin in raw_origins.split(",")]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ScanRequest(BaseModel):
    bicep_code: str
    policies: list = []

Parser=Parser()

@app.get("/api/test")
async def test_endpoint():
    print("API is being Requested")
    return {"status": "success"}


import asyncio
import httpx
from fastapi import HTTPException, Depends, Request


@app.post("/api/policies/import")
async def import_policies(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    azure_headers = {"Authorization": f"Bearer {token}"}

    # Increase timeout to 30s to avoid the 'bruh' moments with Azure API
    timeout = httpx.Timeout(30.0, connect=10.0)

    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            # 1. Fetch Subscriptions
            sub_resp = await client.get(
                "https://management.azure.com/subscriptions?api-version=2020-01-01",
                headers=azure_headers
            )

            if sub_resp.status_code != 200:
                raise HTTPException(status_code=401, detail="Azure rejected the token.")

            subs = sub_resp.json().get("value", [])
            if not subs:
                return {"status": "error", "message": "No active Azure subscriptions found."}

            sub_id = subs[0]["subscriptionId"]
            print(f"[*] Found Subscription: {sub_id}")

            # 2. Fetch Policy Assignments
            policy_resp = await client.get(
                f"https://management.azure.com/subscriptions/{sub_id}/providers/Microsoft.Authorization/policyAssignments?api-version=2020-09-01",
                headers=azure_headers
            )
            assignments = policy_resp.json().get("value", [])

            # Filter unique definition IDs to avoid redundant calls
            unique_def_ids = list(set([
                a.get("properties", {}).get("policyDefinitionId")
                for a in assignments if a.get("properties", {}).get("policyDefinitionId")
            ]))[:10]  # Increased to 10 for better variety

            print(f"[*] Fetching definitions for {len(unique_def_ids)} unique policies...")

            # 3. CONCURRENT FETCHING (Much Faster)
            async def fetch_definition(def_id):
                try:
                    url = f"https://management.azure.com{def_id}?api-version=2020-09-01"
                    resp = await client.get(url, headers=azure_headers)
                    if resp.status_code == 200:
                        props = resp.json().get("properties", {})
                        return {
                            "displayName": props.get("displayName", "Unnamed Policy"),
                            "policyRule": props.get("policyRule", {})
                        }
                except Exception:
                    return None
                return None

            # Fire all requests at once
            tasks = [fetch_definition(did) for did in unique_def_ids]
            results = await asyncio.gather(*tasks)

            # Filter out any Nones from failed requests
            full_policies = [r for r in results if r is not None]

            return {
                "status": "success",
                "subscription_id": sub_id,
                "policies_count": len(full_policies),
                "policies": full_policies
            }

    except httpx.ConnectTimeout:
        return {"status": "error", "type": "timeout", "message": "Connection to Azure timed out. Try again."}
    except Exception as e:
        print(f"[!] Error: {str(e)}")
        return {"status": "error", "type": "server", "message": "Internal Server Error during policy sync."}

@app.post("/api/scan")
async def scan_infrastructure(request: ScanRequest):
    print("[*] Received Bicep code from the editor.")
    code = request.bicep_code
    policies = request.policies

    try:
        print("[*] Parsing code...")
        graph = Parser.parse(code)

        print("[*] Evaluating policies...")

        print(policies)
        evaluator = PolicyEvaluator(policies=policies)
        evaluatedGraph = evaluator.evaluate(graph)

        print("[+] Success! Sending graph to React.")
        return {
            "status": "success",
            "nodes": evaluatedGraph["nodes"],
            "edges": evaluatedGraph["edges"]
        }

    except Exception as e:
        import traceback
        print("\n[!!!] CRITICAL ERROR DURING SCAN [!!!]")
        print(traceback.format_exc())
        error=str(e)
        try: error=error[error.index("main.bicep"):]
        except: error="Error"
        return {
            "status": "error",
            "message": error,
            "error_code": 101,
        }