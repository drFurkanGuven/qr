import json
import random
import re
import time
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Optional, Tuple


class PlaceholderEngine:
    """Engine for resolving dynamic placeholders in URLs, headers, and request bodies."""

    RANDOM_INT_PATTERN = re.compile(r"\{\{random_int:(\d+):(\d+)\}\}")
    PLACEHOLDER_PATTERN = re.compile(r"\{\{([a-zA-Z0-9_-]+)\}\}")

    @classmethod
    def get_built_in_variables(cls, input_value: str) -> Dict[str, str]:
        now = datetime.now(timezone.utc)
        return {
            "qr_data": input_value,
            "input": input_value,
            "timestamp": str(int(time.time())),
            "iso_timestamp": now.isoformat(),
            "date": now.strftime("%Y-%m-%d"),
            "time": now.strftime("%H:%M:%S"),
            "uuid": str(uuid.uuid4()),
        }

    @classmethod
    def resolve_text(
        cls,
        text: Optional[str],
        input_value: str,
        custom_vars: Optional[Dict[str, str]] = None,
    ) -> Optional[str]:
        if not text:
            return text

        # Merge built-ins with custom variables (custom variables can override or add)
        variables = cls.get_built_in_variables(input_value)
        if custom_vars:
            variables.update({str(k): str(v) for k, v in custom_vars.items()})

        # 1. Resolve random_int:min:max
        def replace_random_int(match: re.Match) -> str:
            min_val = int(match.group(1))
            max_val = int(match.group(2))
            if min_val > max_val:
                min_val, max_val = max_val, min_val
            return str(random.randint(min_val, max_val))

        result = cls.RANDOM_INT_PATTERN.sub(replace_random_int, text)

        # 2. Resolve named variables like {{qr_data}}, {{timestamp}}, etc.
        def replace_variable(match: re.Match) -> str:
            var_name = match.group(1)
            return variables.get(var_name, match.group(0))

        result = cls.PLACEHOLDER_PATTERN.sub(replace_variable, result)
        return result

    @classmethod
    def resolve_dict(
        cls,
        data: Optional[Dict[str, Any]],
        input_value: str,
        custom_vars: Optional[Dict[str, str]] = None,
    ) -> Dict[str, Any]:
        if not data:
            return {}

        resolved: Dict[str, Any] = {}
        for key, value in data.items():
            resolved_key = cls.resolve_text(str(key), input_value, custom_vars) or str(key)
            if isinstance(value, str):
                resolved[resolved_key] = cls.resolve_text(value, input_value, custom_vars)
            elif isinstance(value, dict):
                resolved[resolved_key] = cls.resolve_dict(value, input_value, custom_vars)
            elif isinstance(value, list):
                resolved[resolved_key] = [
                    cls.resolve_text(item, input_value, custom_vars) if isinstance(item, str) else item
                    for item in value
                ]
            else:
                resolved[resolved_key] = value
        return resolved

    @classmethod
    def resolve_template(
        cls,
        url: str,
        method: str,
        headers: Dict[str, Any],
        body: Optional[str],
        query_params: Dict[str, Any],
        input_value: str,
        custom_vars: Optional[Dict[str, str]] = None,
    ) -> Tuple[str, Dict[str, Any], Optional[str], Dict[str, Any]]:
        """Resolves all placeholders in URL, headers, body, and query parameters."""
        resolved_url = cls.resolve_text(url, input_value, custom_vars) or url
        resolved_headers = cls.resolve_dict(headers, input_value, custom_vars)
        resolved_query_params = cls.resolve_dict(query_params, input_value, custom_vars)
        resolved_body = cls.resolve_text(body, input_value, custom_vars)

        return resolved_url, resolved_headers, resolved_body, resolved_query_params
