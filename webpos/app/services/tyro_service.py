from flask import current_app
import json
import requests
from typing import Tuple, Optional, Dict

class TyroService:
    def __init__(self):
        self.api_key = current_app.config.get('TYRO_API_KEY')
        self.base_url = current_app.config.get('TYRO_API_URL', 'https://iclientsimulator.test.tyro.com')
        self.pos_product_info = {
            "posProductVendor": "BasicPOS",
            "posProductName": "WebPOS",
            "posProductVersion": "1.0.0",
            "siteReference": current_app.config.get('SITE_REFERENCE', 'default')
        }

    def pair_terminal(self, merchant_id: str, terminal_id: str) -> Tuple[Optional[Dict], Optional[str]]:
        """
        Pair with a Tyro terminal
        """
        try:
            url = f"{self.base_url}/pair"
            headers = {
                'Content-Type': 'application/json',
                'Authorization': f'Bearer {self.api_key}'
            }
            data = {
                'merchantId': merchant_id,
                'terminalId': terminal_id,
                'posProductInfo': self.pos_product_info
            }
            
            response = requests.post(url, headers=headers, json=data)
            response.raise_for_status()
            
            return response.json(), None
        except requests.exceptions.RequestException as e:
            return None, f"Failed to pair terminal: {str(e)}"

    def process_payment(self, amount: float, merchant_id: str, terminal_id: str, integration_key: str) -> Tuple[Optional[Dict], Optional[str]]:
        """
        Process a payment through Tyro EFTPOS
        """
        try:
            url = f"{self.base_url}/payment"
            headers = {
                'Content-Type': 'application/json',
                'Authorization': f'Bearer {self.api_key}',
                'X-Integration-Key': integration_key
            }
            data = {
                'amount': amount,
                'merchantId': merchant_id,
                'terminalId': terminal_id,
                'posProductInfo': self.pos_product_info
            }
            
            response = requests.post(url, headers=headers, json=data)
            response.raise_for_status()
            
            return response.json(), None
        except requests.exceptions.RequestException as e:
            return None, f"Failed to process payment: {str(e)}"

    def get_terminal_info(self, merchant_id: str, terminal_id: str, integration_key: str) -> Tuple[Optional[Dict], Optional[str]]:
        """
        Get information about a paired terminal
        """
        try:
            url = f"{self.base_url}/terminal-info"
            headers = {
                'Content-Type': 'application/json',
                'Authorization': f'Bearer {self.api_key}',
                'X-Integration-Key': integration_key
            }
            params = {
                'merchantId': merchant_id,
                'terminalId': terminal_id
            }
            
            response = requests.get(url, headers=headers, params=params)
            response.raise_for_status()
            
            return response.json(), None
        except requests.exceptions.RequestException as e:
            return None, f"Failed to get terminal info: {str(e)}" 