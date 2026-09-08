import logging
import urllib.parse
from typing import Any, Dict, Optional

import requests

try:
    from .config import BACKEND_API_TIMEOUT, BACKEND_API_URL, WHATSAPP_SERVICE_KEY
except (ImportError, ValueError):
    from config import BACKEND_API_TIMEOUT, BACKEND_API_URL, WHATSAPP_SERVICE_KEY

logger = logging.getLogger("medikiosk.whatsapp.auth_client")


class WhatsAppAuthError(Exception):
    """Raised when communication with the MediKiosk Backend Auth service fails."""
    pass


class WhatsAppAuthClient:
    """
    HTTP client abstraction connecting the WhatsApp Selenium bot to
    MediKiosk's backend authentication service.

    The backend is the sole source of truth for:
    - Verifying linking tokens
    - Storing WhatsApp identity ↔ MediKiosk user mapping
    - Determining linked/unlinked account status

    Security Note:
    Plaintext tokens are NEVER stored in instance state or logged to console/files.
    """

    def __init__(
        self,
        base_url: Optional[str] = None,
        timeout: Optional[int] = None,
    ):
        raw_url = (base_url or BACKEND_API_URL).rstrip("/")
        # Normalize so we have root backend host (e.g. http://localhost:5001)
        if raw_url.endswith("/api/auth"):
            self.auth_base = raw_url
        elif raw_url.endswith("/api"):
            self.auth_base = f"{raw_url}/auth"
        else:
            self.auth_base = f"{raw_url}/api/auth"

        self.timeout = timeout or BACKEND_API_TIMEOUT

    def check_link_status(self, whatsapp_id: str) -> Dict[str, Any]:
        """
        Queries the backend to determine if the WhatsApp identity is linked
        to an existing MediKiosk account.

        Endpoint: GET /api/auth/whatsapp/status?whatsapp_id=<id>
        Returns:
            {"linked": bool, "user_id": Optional[str], "user_name": Optional[str]}
        """
        if not whatsapp_id:
            return {"linked": False}

        url = f"{self.auth_base}/whatsapp/status"
        params = {"whatsapp_id": str(whatsapp_id).strip()}

        try:
            res = requests.get(url, params=params, timeout=self.timeout)
            if res.status_code == 200:
                data = res.json()
                return {
                    "linked": bool(data.get("linked", False)),
                    "user_id": data.get("user_id"),
                    "user_name": data.get("user_name"),
                    "language": data.get("language"),
                }
            logger.warning(
                "Non-200 response checking WhatsApp link status (%d): %s",
                res.status_code,
                res.text,
            )
            return {"linked": False}
        except requests.RequestException as exc:
            logger.error("Failed to reach backend for WhatsApp link status check: %s", exc)
            return {"linked": False, "error": str(exc)}

    def is_linked(self, whatsapp_id: str) -> bool:
        """Convenience helper returning True if the WhatsApp identity is linked."""
        status = self.check_link_status(whatsapp_id)
        return bool(status.get("linked", False))

    def get_user_name(self, whatsapp_id: str) -> Optional[str]:
        """Convenience helper returning the user's name if linked."""
        status = self.check_link_status(whatsapp_id)
        return status.get("user_name")

    def get_account_language(self, whatsapp_id: str) -> Optional[str]:
        """Convenience helper returning the user's account language if linked."""
        status = self.check_link_status(whatsapp_id)
        return status.get("language")

    def verify_and_link(self, whatsapp_id: str, token: str, language: Optional[str] = None) -> Dict[str, Any]:
        """
        Submits candidate linking token to the backend for verification.
        Optionally persists chosen language to user's account upon success.

        Endpoint: POST /api/auth/whatsapp/link
        Payload: {"whatsapp_id": "...", "token": "...", "language": "..."}

        Security Policy:
        The token is NEVER logged in plaintext or retained in client memory.
        """
        normalized_id = str(whatsapp_id).strip()
        cleaned_token = str(token).strip()

        # Secure audit logging (no plaintext token logged)
        logger.info("WhatsApp account linking attempted")

        url = f"{self.auth_base}/whatsapp/link"
        payload = {
            "whatsapp_id": normalized_id,
            "token": cleaned_token,
        }
        if language:
            payload["language"] = str(language).strip().lower()

        try:
            res = requests.post(url, json=payload, timeout=self.timeout)
            if res.status_code == 200:
                data = res.json()
                if data.get("success"):
                    logger.info("WhatsApp account linked successfully")
                    return {
                        "success": True,
                        "user_id": data.get("user_id"),
                        "user_name": data.get("user_name") or "",
                        "language": data.get("language"),
                    }
            elif res.status_code == 400:
                data = {}
                try:
                    data = res.json()
                except Exception:
                    pass
                logger.warning("WhatsApp account linking rejected by backend (invalid/expired token)")
                return {
                    "success": False,
                    "message": data.get("message", "The token entered could not be verified."),
                }

            logger.warning(
                "WhatsApp account linking returned status %d: %s",
                res.status_code,
                res.text,
            )
            return {
                "success": False,
                "message": "Token verification failed.",
            }
        except requests.RequestException as exc:
            logger.error("Failed to connect to backend during WhatsApp linking: %s", exc)
            return {
                "success": False,
                "message": "Connection error with MediKiosk authentication server.",
                "error": str(exc),
            }

    def update_account_language(self, whatsapp_id: str, language: str) -> Dict[str, Any]:
        """
        Updates the account language for an already linked WhatsApp user in PostgreSQL.

        Endpoint: POST /api/auth/whatsapp/language
        Header: X-WhatsApp-Service-Key: <key>
        Payload: {"whatsapp_id": "...", "language": "..."}
        """
        normalized_id = str(whatsapp_id).strip()
        clean_lang = str(language).strip().lower()

        url = f"{self.auth_base}/whatsapp/language"
        headers = {
            "X-WhatsApp-Service-Key": WHATSAPP_SERVICE_KEY,
        }
        payload = {
            "whatsapp_id": normalized_id,
            "language": clean_lang,
        }

        try:
            res = requests.post(url, json=payload, headers=headers, timeout=self.timeout)
            if res.status_code == 200:
                data = res.json()
                return {
                    "success": True,
                    "language": data.get("language", clean_lang),
                }
            logger.warning("Failed to update account language (%d): %s", res.status_code, res.text)
            return {
                "success": False,
                "status_code": res.status_code,
            }
        except requests.RequestException as exc:
            logger.error("Failed to connect to backend during language update: %s", exc)
            return {
                "success": False,
                "error": str(exc),
            }


# Default shared client instance
whatsapp_auth_client = WhatsAppAuthClient()
