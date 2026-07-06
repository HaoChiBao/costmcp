"""CostMCP Python SDK — thin HTTP client for pipeline integration."""

from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from typing import Any


class CostClient:
    def __init__(
        self,
        *,
        api_key: str | None = None,
        project: str,
        base_url: str | None = None,
    ) -> None:
        self.api_key = api_key or os.environ.get("COSTMCP_API_KEY", "")
        self.project = project
        self.base_url = (base_url or os.environ.get("COSTMCP_API_URL", "http://localhost:3000")).rstrip("/")
        if not self.api_key:
            raise ValueError("COSTMCP_API_KEY or api_key is required")

    def _post(self, path: str, payload: dict[str, Any]) -> dict[str, Any]:
        req = urllib.request.Request(
            f"{self.base_url}{path}",
            data=json.dumps(payload).encode(),
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {self.api_key}",
            },
            method="POST",
        )
        try:
            with urllib.request.urlopen(req) as resp:
                return json.loads(resp.read().decode())
        except urllib.error.HTTPError as exc:
            body = exc.read().decode()
            raise RuntimeError(body or exc.reason) from exc

    def log_usage(
        self,
        *,
        provider: str,
        unit_type: str,
        quantity: float,
        model: str | None = None,
        estimated_cost: float | None = None,
        feature: str | None = None,
        batch_id: str | None = None,
        idempotency_key: str | None = None,
    ) -> dict[str, Any]:
        envelope: dict[str, Any] = {
            "project": self.project,
            "source": "api",
            "message": {
                "type": "usage",
                "provider": provider,
                "unit_type": unit_type,
                "quantity": quantity,
            },
        }
        if model:
            envelope["message"]["model"] = model
        if estimated_cost is not None:
            envelope["message"]["estimated_cost"] = estimated_cost
        if feature:
            envelope["message"]["feature"] = feature
        if batch_id:
            envelope["message"]["batch_id"] = batch_id
        if idempotency_key:
            envelope["idempotency_key"] = idempotency_key
        return self._post("/api/v1/messages", envelope)
