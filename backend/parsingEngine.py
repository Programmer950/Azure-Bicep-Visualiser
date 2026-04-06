import subprocess
import json
import tempfile
import os


class Parser:
    def __init__(self):
        self.RESOURCE_TYPE_MAP = {
            "Microsoft.Network/virtualNetworks": "vnet",
            "Microsoft.Network/virtualNetworks/subnets": "subnet",
            "Microsoft.Compute/virtualMachines": "server",
            "Microsoft.Storage/storageAccounts": "storage",
            "Microsoft.Sql/servers": "database",
            "Microsoft.Sql/servers/databases": "database",
            "Microsoft.KeyVault/vaults": "keyvault",
            "Microsoft.Web/sites": "web",
            "Microsoft.ContainerService/managedClusters": "kubernetes"
        }

        if os.name == 'nt':
            self.bicep_base_cmd = ["az", "bicep"]
        else:
            self.bicep_base_cmd = ["bicep"]

    def compile_bicep_to_arm(self, bicep_code: str) -> dict:
        with tempfile.TemporaryDirectory() as temp_dir:
            bicep_file_path = os.path.join(temp_dir, "main.bicep")
            arm_file_path = os.path.join(temp_dir, "main.json")

            with open(bicep_file_path, "w", encoding="utf-8") as f:
                f.write(bicep_code)

            if os.name == 'nt':
                command = self.bicep_base_cmd + [
                    "build",
                    "--file", bicep_file_path,
                    "--outfile", arm_file_path
                ]
            else:
                command = self.bicep_base_cmd + [
                    "build",
                    bicep_file_path,
                    "--outfile", arm_file_path
                ]

            try:
                is_windows = os.name == 'nt'
                result = subprocess.run(
                    command,
                    check=True,
                    capture_output=True,
                    text=True,
                    shell=is_windows
                )

                with open(arm_file_path, "r") as f:
                    arm_template = json.load(f)

                return arm_template

            except subprocess.CalledProcessError as e:
                error_msg = e.stderr.strip() if e.stderr else e.stdout.strip()
                print(f"[!] Bicep Compilation Failed: {error_msg}")
                raise ValueError(error_msg or "Bicep compilation failed with an empty error message.")

            except FileNotFoundError:
                cmd_str = " ".join(self.bicep_base_cmd)
                raise RuntimeError(f"CLI '{cmd_str}' not found. Ensure Bicep is installed.")

    def compileGraph(self, armJson: dict) -> dict:
        resources = armJson.get('resources', [])
        nodes = []
        edges = []
        edge_counter = 1

        for i in resources:
            azure_type = i.get("type", "Unknown Type")
            # Default to 'vnet' or a generic icon if the specific type isn't mapped
            icon_type = self.RESOURCE_TYPE_MAP.get(azure_type, "vnet")
            raw_name = i.get("name", "unknown")

            node_name = raw_name
            if raw_name.startswith("[format("):
                parts = raw_name.split("'")
                if len(parts) >= 4:
                    node_name = parts[-2]
            elif raw_name.startswith("["):
                parts = raw_name.split("'")
                node_name = parts[1] if len(parts) > 1 else raw_name.strip("[]")

            raw_location = i.get("location", "global")
            location = raw_location

            if isinstance(raw_location, str) and raw_location.startswith("[parameters('"):
                param_name = raw_location.split("'")[1]
                param_data = armJson.get("parameters", {}).get(param_name, {})
                location = param_data.get("defaultValue", f"var: {param_name}")

            dic = {
                "id": node_name,
                "type": "azureNode",
                "position": {"x": 0, "y": 0},
                "data": {
                    "label": node_name,
                    "icon": icon_type,
                    "location": location,
                    "azureType": azure_type,
                    "isViolating": False,
                    "properties": i.get("properties", {})
                }
            }
            nodes.append(dic)

            if "dependsOn" in i:
                for j in i["dependsOn"]:
                    try:
                        parts = j.split("'")
                        if len(parts) >= 4:
                            dependent_resource = parts[3]
                        else:
                            dependent_resource = j.split(",")[1].strip(" ')]") if "," in j else parts[1]
                    except Exception:
                        continue

                    edges.append({
                        "id": f"e{edge_counter}",
                        "source": dependent_resource,
                        "target": node_name,
                        "animated": True,
                        "style": {"stroke": "#a1a1aa"}
                    })
                    edge_counter += 1

        return {
            "status": "success",
            "nodes": nodes,
            "edges": edges
        }

    def parse(self, bicep_code: str) -> dict:
        arm_json = self.compile_bicep_to_arm(bicep_code)
        graph_data = self.compileGraph(arm_json)
        return graph_data