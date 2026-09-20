"""
Reusable Bhashini API client handling authentication, HTTP requests,
timeouts, response validation, and safe error logging.
"""

import logging
import time
from typing import Any, Dict, Optional
import requests

from .config import (
    get_bhashini_inference_api_key,
    get_bhashini_inference_url,
)
from .exceptions import (
    MissingApiKeyError,
    BhashiniAuthenticationError,
    BhashiniRateLimitError,
    BhashiniTimeoutError,
    BhashiniNetworkError,
    BhashiniApiError,
    BhashiniResponseError,
)

logger = logging.getLogger("medikiosk.bhashini.client")


class BhashiniClient:
    """
    Central HTTP client for Bhashini pipeline inference requests.
    Encapsulates connection details, authorization headers, and response parsing.
    """

    def __init__(
        self,
        inference_api_key: Optional[str] = None,
        inference_url: Optional[str] = None,
        timeout: float = 30.0,
    ):
        self._inference_api_key = inference_api_key
        self._inference_url = inference_url
        self.timeout = timeout

    @property
    def inference_url(self) -> str:
        """Returns the inference endpoint URL."""
        return self._inference_url or get_bhashini_inference_url()

    def _get_api_key(self) -> str:
        """Returns the active inference API key or raises MissingApiKeyError."""
        key = self._inference_api_key or get_bhashini_inference_api_key()
        if not key:
            raise MissingApiKeyError()
        return key

    def _get_headers(self) -> Dict[str, str]:
        """Constructs headers with inference API key authorization."""
        api_key = self._get_api_key()
        return {
            "Authorization": api_key,
            "Content-Type": "application/json",
            "Accept": "application/json",
            "User-Agent": "MediKiosk-ML-Service/1.0",
        }

    def send_pipeline_request(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """
        Sends a pipeline request to the Bhashini inference endpoint.

        Args:
            payload: Bhashini ULCA pipeline request dictionary containing
                     pipelineTasks and inputData.

        Returns:
            Parsed JSON response dictionary.

        Raises:
            MissingApiKeyError: If API key is not configured.
            BhashiniAuthenticationError: On 401 or 403 HTTP status.
            BhashiniRateLimitError: On 429 HTTP status.
            BhashiniTimeoutError: On network or read timeout.
            BhashiniNetworkError: On socket or DNS connection failure.
            BhashiniApiError: On unexpected 4xx/5xx HTTP errors.
            BhashiniResponseError: If response body is not valid JSON.
        """
        headers = self._get_headers()
        url = self.inference_url

        # Determine task types for safe operational logging without exposing audio/text/keys
        tasks = [t.get("taskType", "unknown") for t in payload.get("pipelineTasks", [])]
        logger.info("Sending Bhashini pipeline inference request: url=%s, tasks=%s", url, tasks)

        start_time = time.perf_counter()

        try:
            response = requests.post(
                url=url,
                json=payload,
                headers=headers,
                timeout=self.timeout,
            )
            duration = time.perf_counter() - start_time

            logger.info(
                "Bhashini pipeline response received in %.2fs: status_code=%d",
                duration,
                response.status_code,
            )

            # Check status codes
            if response.status_code in (401, 403):
                logger.error("Bhashini authentication failed (HTTP %d)", response.status_code)
                raise BhashiniAuthenticationError()

            if response.status_code == 429:
                logger.warning("Bhashini rate limit exceeded (HTTP 429)")
                raise BhashiniRateLimitError()

            if response.status_code >= 400:
                # Sanitize response text so no token echoes
                error_snippet = response.text[:200].replace(headers.get("Authorization", ""), "[REDACTED]")
                logger.error(
                    "Bhashini API error HTTP %d: %s",
                    response.status_code,
                    error_snippet,
                )
                raise BhashiniApiError(
                    message=f"Bhashini API error HTTP {response.status_code}: {error_snippet}",
                    status_code=response.status_code,
                )

            # Parse JSON
            try:
                data = response.json()
            except ValueError as exc:
                logger.error("Bhashini response is not valid JSON: %s", exc)
                raise BhashiniResponseError("Bhashini inference endpoint returned invalid JSON.") from exc

            # Check for ULCA error envelope
            if isinstance(data, dict):
                if data.get("is_error") or "error" in data:
                    err_msg = str(data.get("message") or data.get("error") or "Unknown upstream error")
                    logger.error("Bhashini pipeline returned error status: %s", err_msg)
                    raise BhashiniApiError(f"Bhashini upstream error: {err_msg}", status_code=502)

            return data

        except requests.exceptions.Timeout as exc:
            duration = time.perf_counter() - start_time
            logger.error("Bhashini request timed out after %.2fs", duration)
            raise BhashiniTimeoutError(f"Bhashini inference request timed out after {self.timeout}s.") from exc

        except requests.exceptions.ConnectionError as exc:
            logger.error("Bhashini connection failed: %s", exc.__class__.__name__)
            raise BhashiniNetworkError("Could not connect to Bhashini inference service.") from exc

        except requests.exceptions.RequestException as exc:
            logger.error("Bhashini HTTP request exception: %s", str(exc))
            raise BhashiniApiError(f"Bhashini request failed: {exc.__class__.__name__}") from exc
