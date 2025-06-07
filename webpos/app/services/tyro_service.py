from flask import current_app, g
import json
import requests
import time
from typing import Tuple, Optional, Dict

# Simple in-memory cache for the access token
def get_cached_token():
    """Gets the token from the application context or returns None if not present/expired."""
    token_info = g.get('_tyro_token_info')
    if token_info and token_info['expires_at'] > time.time():
        return token_info['access_token']
    return None

def set_cached_token(token, expires_in):
    """Saves the token to the application context with an expiry time."""
    g._tyro_token_info = {
        'access_token': token,
        'expires_at': time.time() + expires_in - 60  # -60s buffer
    }

class TyroService:
    def __init__(self):
        self.client_id = current_app.config.get('TYRO_CLIENT_ID')
        self.client_secret = current_app.config.get('TYRO_CLIENT_SECRET')
        self.base_url = current_app.config.get('TYRO_API_URL')
        self.pos_product_info = {
            "posProductVendor": "BasicPOS",
            "posProductName": "WebPOS",
            "posProductVersion": "1.0.0",
            "siteReference": current_app.config.get('SITE_REFERENCE', 'default')
        }

    def _get_access_token(self) -> Tuple[Optional[str], Optional[str]]:
        """
        Fetches a new access token using Client Credentials Flow.
        Caches the token in the application context (g).
        """
        cached_token = get_cached_token()
        if cached_token:
            return cached_token, None

        try:
            url = "https://auth.connect.tyro.com/oauth/token"
            headers = {'Content-Type': 'application/x-www-form-urlencoded'}
            data = {
                'grant_type': 'client_credentials',
                'client_id': self.client_id,
                'client_secret': self.client_secret
            }
            
            response = requests.post(url, headers=headers, data=data)
            response.raise_for_status()
            
            token_data = response.json()
            access_token = token_data.get('access_token')
            expires_in = token_data.get('expires_in', 3600)
            set_cached_token(access_token, expires_in)

            return access_token, None
        except requests.exceptions.RequestException as e:
            error_message = f"Failed to get access token: {str(e)}"
            if e.response:
                error_message += f" - {e.response.text}"
            return None, error_message
        except Exception as e:
            return None, f"An unexpected error occurred while getting the access token: {e}"

    def pair_terminal(self, merchant_id: str, terminal_id: str) -> Tuple[Optional[Dict], Optional[str]]:
        """
        Pair with a Tyro terminal (Updated for Tyro Connect API)
        Note: Pairing in Tyro Connect is often done via different means (e.g., in the Tyro portal).
        This method is a placeholder for a compatible RESTful pairing if available.
        The primary pairing mechanism might be device-code flow for instance connections.
        Assuming a cloud model, we might not need an explicit pairing endpoint like this.
        This function remains for now but may be deprecated.
        """
        access_token, error = self._get_access_token()
        if error:
            return None, error
            
        # The actual endpoint for pairing in Tyro Connect needs to be confirmed.
        # This is a hypothetical endpoint.
        url = f"{self.base_url}/v1/terminals/pair"
        headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {access_token}'
        }
        data = {
            'merchantId': merchant_id,
            'terminalId': terminal_id,
            'posProductInfo': self.pos_product_info
        }
        
        try:
            response = requests.post(url, headers=headers, json=data)
            response.raise_for_status()
            return response.json(), None
        except requests.exceptions.RequestException as e:
            return None, f"Failed to pair terminal: {str(e)}"

    def process_payment(self, mid: str, tid: str, transaction_id: str, amount_cents: int) -> Tuple[Optional[Dict], Optional[str]]:
        """
        Process a payment through Tyro Connect API using the instore/transaction model.
        """
        access_token, error = self._get_access_token()
        if error:
            return None, error

        try:
            # Based on the payload, this is likely a general transaction endpoint.
            # Using /v1/transactions as a logical guess.
            url = f"{self.base_url}/v1/transactions"
            headers = {
                'Content-Type': 'application/json',
                'Authorization': f'Bearer {access_token}'
            }
            data = {
                "mid": mid,
                "tid": tid,
                "origin": {
                    "orderId": transaction_id,
                    "transactionId": transaction_id
                },
                "total": {
                    "goodsAndServicesAmount": amount_cents,
                    "cashoutAmount": 0,
                    "refundAmount": 0,
                    "currency": "AUD"
                }
            }
            
            response = requests.post(url, headers=headers, json=data)
            response.raise_for_status()
            
            return response.json(), None
        except requests.exceptions.RequestException as e:
            error_message = f"Failed to process payment: {str(e)}"
            if e.response is not None:
                error_message += f" - Status: {e.response.status_code}, Body: {e.response.text}"
            return None, error_message
        except Exception as e:
            return None, f"An unexpected error occurred during payment processing: {str(e)}"

    def get_terminal_info(self, merchant_id: str, terminal_id: str) -> Tuple[Optional[Dict], Optional[str]]:
        """
        Get information about a terminal using Tyro Connect API.
        The endpoint for getting terminal info needs to be confirmed from Tyro Connect docs.
        This is a placeholder based on logical REST principles.
        """
        access_token, error = self._get_access_token()
        if error:
            return None, error

        try:
            url = f"{self.base_url}/v1/merchants/{merchant_id}/terminals/{terminal_id}"
            headers = {
                'Authorization': f'Bearer {access_token}'
            }
            
            response = requests.get(url, headers=headers)
            response.raise_for_status()
            
            return response.json(), None
        except requests.exceptions.RequestException as e:
            return None, f"Failed to get terminal info: {str(e)}"
        except Exception as e:
            return None, f"An unexpected error occurred while fetching terminal info: {str(e)}" 