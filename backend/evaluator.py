class PolicyEvaluator:
    def __init__(self, policies: list):
        self.policies = policies

    def _resolve_field(self, properties: dict, field_path: str):
        keys = field_path.split('.')
        current_val = properties
        for key in keys:
            if isinstance(current_val, dict):
                current_val = current_val.get(key)
            else:
                return None
        return current_val

    def _evaluate_condition(self, actual_value, condition_type, expected_value) -> bool:
        """
        Evaluates the specific Azure Policy operator.
        Returns True if the condition is met (Violation).
        """
        if actual_value is None:
            if condition_type == "exists":
                return str(expected_value).lower() == 'false'
            return False

        val_str = str(actual_value).lower()

        if condition_type == "equals":
            return val_str == str(expected_value).lower()

        elif condition_type == "notEquals":
            return val_str != str(expected_value).lower()

        elif condition_type == "exists":
            return (actual_value is not None) == (str(expected_value).lower() == 'true')

        elif condition_type == "in":
            if isinstance(expected_value, list):
                return actual_value in expected_value
            return val_str in str(expected_value).lower()

        elif condition_type == "notIn":
            if isinstance(expected_value, list):
                return actual_value not in expected_value
            return val_str not in str(expected_value).lower()

        elif condition_type == "contains":
            return str(expected_value).lower() in val_str

        elif condition_type == "notContains":
            return str(expected_value).lower() not in val_str

        elif condition_type == "match":
            import fnmatch
            return fnmatch.fnmatch(val_str, str(expected_value).lower())

        return False

    def _evaluate_logical_block(self, block: dict, properties: dict, azure_type: str, node_metadata: dict) -> bool:
        if "allOf" in block:
            return all(
                self._evaluate_logical_block(cond, properties, azure_type, node_metadata) for cond in block["allOf"])

        elif "anyOf" in block:
            return any(
                self._evaluate_logical_block(cond, properties, azure_type, node_metadata) for cond in block["anyOf"])

        elif "field" in block:
            field_path = block["field"]

            for op, val in block.items():
                if isinstance(val, str) and "[parameters(" in val:
                    return False

            if field_path == "type":
                actual_value = azure_type
            elif field_path == "location":
                # We pull from node_metadata which we passed down from evaluate()
                actual_value = node_metadata.get("location", "global")
            else:
                clean_path = field_path.split("/")[-1] if "/" in field_path else field_path
                actual_value = self._resolve_field(properties, clean_path)

            for operator, expected_value in block.items():
                if operator == "field":
                    continue
                return self._evaluate_condition(actual_value, operator, expected_value)

        return False

    def evaluate(self, graph_data: dict) -> dict:
        nodes = graph_data.get("nodes", [])

        for node in nodes:
            node_data = node.get("data", {})
            azure_type = node_data.get("azureType", "")
            properties = node_data.get("properties", {})

            node_metadata = {
                "location": node_data.get("location", "global"),
                "label": node_data.get("label", "")
            }

            node_data["isViolating"] = False
            violations = []

            for policy in self.policies:
                policy_rule = policy.get("policyRule", {})
                if_block = policy_rule.get("if", {})

                if not if_block:
                    continue

                is_triggered = self._evaluate_logical_block(if_block, properties, azure_type, node_metadata)

                if is_triggered:
                    violations.append(policy.get("displayName", "Unnamed Policy"))

            if violations:
                node_data["isViolating"] = True
                node_data["violationMessage"] = " | ".join(violations)

            node_data.pop("properties", None)

        return graph_data