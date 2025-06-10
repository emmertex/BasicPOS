import logging
from xero_python.api_client import ApiClient
from xero_python.api_client.configuration import Configuration
from xero_python.api_client.oauth2 import OAuth2
from xero_python.exceptions import OpenApiException
from xero_python.identity import build_identity_api
from xero_python.accounting import AccountingApi, Contact, Invoice, LineItem, Payment, Account
from xero_python.api_client.oauth2.token import Token
import json
import os
from flask import current_app

logging.basicConfig(level=logging.DEBUG)

class XeroService:
    def __init__(self):
        try:
            with open(os.path.join(os.path.dirname(__file__), '..', '..', 'xero_credentials.json')) as f:
                self.xero_credentials = json.load(f)
            
            self.api_client = ApiClient(
                Configuration(
                    debug=True,
                    oauth2_token=OAuth2(
                        **self.xero_credentials
                    )
                ),
                pool_threads=1,
            )
        except FileNotFoundError:
            logging.error("xero_credentials.json not found.")
            self.api_client = None
        except Exception as e:
            logging.error(f"Failed to initialize Xero API client: {e}")
            self.api_client = None

    def _get_token(self):
        # This is a placeholder for a real token management function.
        # In a real app, you'd fetch a stored token and refresh it if necessary.
        logging.debug("Getting Xero token...")
        try:
            with open(os.path.join(os.path.dirname(__file__), '..', '..', 'xero_token.json')) as f:
                token = json.load(f)
            return token
        except FileNotFoundError:
            logging.error("xero_token.json not found. Please authenticate with Xero first.")
            return None
        except Exception as e:
            logging.error(f"Error reading Xero token: {e}")
            return None

    def create_invoice(self, sale_details):
        if not self.api_client:
            logging.error("Xero API client not initialized.")
            return None, "Xero API client not initialized."
            
        token = self._get_token()
        if not token:
            return None, "Xero token not available."
            
        xero_tenant_id = token.get('xero_tenant_id')
        accounting_api = AccountingApi(self.api_client)

        logging.debug(f"Creating Xero invoice for sale ID: {sale_details['id']}")
        
        try:
            contact = Contact(name=sale_details['customer']['name'] if sale_details.get('customer') else 'Walk-in Customer')
            
            line_items = []
            for item in sale_details['sale_items']:
                line_item = LineItem(
                    description=item['item']['name'],
                    quantity=item['quantity'],
                    unit_amount=item['sale_price'],
                    account_code=current_app.config['XERO_SALES_ACCOUNT']
                )
                line_items.append(line_item)

            invoice = Invoice(
                type='ACCREC',
                contact=contact,
                line_items=line_items,
                date=sale_details['created_at'],
                due_date=sale_details['created_at'],
                reference=f"Sale #{sale_details['id']}",
                status='AUTHORISED'
            )

            invoices = accounting_api.create_invoices(xero_tenant_id, invoices=[invoice])
            created_invoice = invoices.invoices[0]
            logging.debug(f"Successfully created Xero invoice: {created_invoice.invoice_id}")
            return created_invoice, None

        except OpenApiException as e:
            logging.error(f"Error creating Xero invoice: {e}")
            return None, str(e)

    def create_payment(self, sale_id, payment_details):
        if not self.api_client:
            logging.error("Xero API client not initialized.")
            return None, "Xero API client not initialized."

        token = self._get_token()
        if not token:
            return None, "Xero token not available."
            
        xero_tenant_id = token.get('xero_tenant_id')
        accounting_api = AccountingApi(self.api_client)

        logging.debug(f"Creating Xero payment for sale ID: {sale_id}")

        try:
            # First, find the invoice in Xero
            invoices = accounting_api.get_invoices(xero_tenant_id, reference=f"Sale #{sale_id}")
            if not invoices.invoices:
                logging.error(f"Could not find Xero invoice for sale ID: {sale_id}")
                return None, f"Could not find Xero invoice for sale ID: {sale_id}"
            
            invoice_id = invoices.invoices[0].invoice_id

            payment = Payment(
                invoice=Invoice(invoice_id=invoice_id),
                account=Account(code=current_app.config['XERO_BANK_ACCOUNT']),
                amount=payment_details['amount'],
                date=payment_details['payment_date']
            )

            payments = accounting_api.create_payments(xero_tenant_id, payments=[payment])
            created_payment = payments.payments[0]
            logging.debug(f"Successfully created Xero payment: {created_payment.payment_id}")
            return created_payment, None

        except OpenApiException as e:
            logging.error(f"Error creating Xero payment: {e}")
            return None, str(e) 