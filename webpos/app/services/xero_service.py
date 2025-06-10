import logging
from datetime import datetime
from xero_python.api_client import ApiClient
from xero_python.api_client.configuration import Configuration
from xero_python.api_client.oauth2 import OAuth2Token
from xero_python.exceptions import OpenApiException
from xero_python.identity import IdentityApi
from xero_python.accounting import AccountingApi, Contact, Contacts, Invoice, Invoices, LineItem, Payment, Payments, Account, LineAmountTypes
import json
import os
from flask import current_app
from decimal import Decimal

logging.basicConfig(level=logging.DEBUG)

class XeroService:
    def __init__(self):
        try:
            with open(os.path.join(os.path.dirname(__file__), '..', '..', 'xero_credentials.json')) as f:
                self.xero_credentials = json.load(f)
            
            # Extract only the client_id and client_secret for OAuth2Token
            oauth2_params = {
                'client_id': self.xero_credentials.get('client_id'),
                'client_secret': self.xero_credentials.get('client_secret')
            }
            
            self.api_client = ApiClient(
                Configuration(
                    debug=True,
                    oauth2_token=OAuth2Token(**oauth2_params)
                ),
                pool_threads=1,
            )
            
            # Register token getter and saver
            @self.api_client.oauth2_token_getter
            def get_oauth2_token():
                return self._get_token()
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
                token_data = json.load(f)
            
            # Check if the token data has the new structure with tenant_id
            if isinstance(token_data, dict) and 'token' in token_data:
                self.tenant_id = token_data.get('tenant_id')
                return token_data['token']
            else:
                # Legacy format - just the token
                self.tenant_id = None
                return token_data
        except FileNotFoundError:
            logging.error("xero_token.json not found. Please authenticate with Xero first.")
            self.tenant_id = None
            return None
        except Exception as e:
            logging.error(f"Error reading Xero token: {e}")
            self.tenant_id = None
            return None
            
    def _get_tenant_id(self):
        # Get the tenant ID from the token file or use a default for testing
        if hasattr(self, 'tenant_id') and self.tenant_id:
            return self.tenant_id
        else:
            logging.warning("No tenant ID found in token file. Using dummy tenant ID for testing.")
            return "dummy_tenant_id"

    def create_invoice(self, sale_details, contact):
        if not self.api_client:
            logging.error("Xero API client not initialized.")
            return None, "Xero API client not initialized."
            
        token = self._get_token()
        if not token:
            return None, "Xero token not available."
            
        # Get the tenant ID from the token file
        xero_tenant_id = self._get_tenant_id()
            
        accounting_api = AccountingApi(self.api_client)

        logging.debug(f"Creating Xero invoice for sale ID: {sale_details['id']}")
        
        try:
            gst_rate = Decimal(current_app.config.get('GST_RATE_PERCENTAGE', '10')) / Decimal('100')
            gst_divisor = Decimal('1') + gst_rate

            line_items = []
            for item in sale_details['sale_items']:
                item_title = item.get('item', {}).get('title')
                if not item_title:
                    logging.warning(f"Skipping item in Xero invoice for sale {sale_details['id']} due to missing title: {item}")
                    continue
                
                price_inclusive = Decimal(str(item.get('sale_price', 0)))
                price_exclusive = price_inclusive / gst_divisor

                line_item = LineItem(
                    description=item_title,
                    quantity=item['quantity'],
                    unit_amount=price_exclusive,
                    account_code=current_app.config['XERO_SALES_ACCOUNT']
                )
                line_items.append(line_item)

            if not line_items:
                logging.warning(f"No valid line items found for Xero invoice for sale {sale_details['id']}. Creating a single summary line.")
                total_amount_inclusive = Decimal(str(sale_details.get('final_grand_total', 0)))
                total_amount_exclusive = total_amount_inclusive / gst_divisor
                line_item = LineItem(
                    description=f"Sale #{sale_details['id']}",
                    quantity=1,
                    unit_amount=total_amount_exclusive,
                    account_code=current_app.config['XERO_SALES_ACCOUNT']
                )
                line_items.append(line_item)

            invoice_date = datetime.fromisoformat(sale_details['created_at']) if sale_details.get('created_at') else datetime.now()
            
            invoice = Invoice(
                type='ACCREC',
                contact=contact,
                line_items=line_items,
                date=invoice_date,
                due_date=invoice_date,
                reference=f"Sale #{sale_details['id']}",
                status='AUTHORISED',
                line_amount_types=LineAmountTypes.EXCLUSIVE
            )

            invoices_container = Invoices(invoices=[invoice])
            created_invoice = accounting_api.create_invoices(xero_tenant_id, invoices=invoices_container, unitdp=4)
            logging.debug(f"Successfully created Xero invoice: {created_invoice.invoices[0].invoice_id}")
            return created_invoice.invoices[0], None

        except OpenApiException as e:
            logging.error(f"Error creating Xero invoice: {e}")
            # Continue with local processing despite Xero error
            logging.info("Continuing with local processing despite Xero error")
            return {"invoice_id": "local-only"}, None
        except Exception as e:
            logging.error(f"Unexpected error creating Xero invoice: {e}")
            # Continue with local processing despite Xero error
            logging.info("Continuing with local processing despite Xero error")
            return {"invoice_id": "local-only"}, None

    def find_or_create_contact(self, customer_details, accounting_api, xero_tenant_id):
        # Default to walk-in customer
        contact_name = "Walk-in Customer"
        if customer_details and customer_details.get("name"):
            contact_name = customer_details["name"]
        
        try:
            where_clause = f'Name=="{contact_name}"'
            existing_contacts = accounting_api.get_contacts(xero_tenant_id, where=where_clause).contacts
            if existing_contacts:
                logging.debug(f"Found existing contact in Xero: {contact_name}")
                return existing_contacts[0], None
            
            logging.debug(f"Creating new contact in Xero: {contact_name}")
            new_contact_obj = Contact(name=contact_name)
            contacts_container = Contacts(contacts=[new_contact_obj])
            created_contacts = accounting_api.create_contacts(xero_tenant_id, contacts=contacts_container)
            return created_contacts.contacts[0], None

        except OpenApiException as e:
            logging.error(f"Error finding or creating Xero contact: {e}")
            return None, str(e)

    def find_or_create_invoice(self, sale_details, contact, accounting_api, xero_tenant_id):
        reference = f"Sale #{sale_details['id']}"
        try:
            where_clause = f'Reference=="{reference}"'
            invoices = accounting_api.get_invoices(xero_tenant_id, where=where_clause).invoices
            if invoices:
                logging.debug(f"Found existing invoice in Xero: {reference}")
                return invoices[0], None
            else:
                logging.debug(f"Creating new invoice in Xero: {reference}")
                return self.create_invoice(sale_details, contact)
        except OpenApiException as e:
            logging.error(f"Error finding or creating Xero invoice: {e}")
            return None, str(e)

    def create_invoice_and_payment(self, sale_details, payment_details):
        if not self.api_client:
            return None, "Xero API client not initialized."

        token = self._get_token()
        if not token:
            return None, "Xero token not available."
            
        xero_tenant_id = self._get_tenant_id()
        accounting_api = AccountingApi(self.api_client)
        
        # 1. Find or create contact
        contact, error = self.find_or_create_contact(sale_details.get('customer'), accounting_api, xero_tenant_id)
        if error:
            return None, f"Failed to process contact in Xero: {error}"
        if not contact:
             return None, "Failed to find or create a Xero contact."

        # 2. Find or create invoice
        invoice, error = self.find_or_create_invoice(sale_details, contact, accounting_api, xero_tenant_id)
        if error:
            return None, f"Failed to process invoice in Xero: {error}"
        
        if not hasattr(invoice, 'invoice_id'):
            return None, f"Failed to create a valid invoice in Xero. Received: {invoice}"
        
        # 3. Create payment
        payment_date = datetime.fromisoformat(payment_details['payment_date']) if payment_details.get('payment_date') else datetime.now()
        
        payment_type = payment_details.get('payment_type')
        if payment_type == 'Cash':
            account_code = current_app.config['XERO_BANK_ACCOUNT_CASH']
        elif payment_type == 'EFTPOS':
            account_code = current_app.config['XERO_BANK_ACCOUNT_EFTPOS']
        elif payment_type == 'Cheque':
            account_code = current_app.config['XERO_BANK_ACCOUNT_CHEQUE']
        else:
            account_code = current_app.config['XERO_BANK_ACCOUNT']

        payment = Payment(
            invoice=Invoice(invoice_id=invoice.invoice_id),
            account=Account(code=account_code),
            amount=payment_details['amount'],
            date=payment_date
        )
        
        try:
            payments_container = Payments(payments=[payment])
            created_payments = accounting_api.create_payments(xero_tenant_id, payments=payments_container)
            logging.debug(f"Successfully created Xero payment: {created_payments.payments[0].payment_id}")
            return created_payments.payments[0], None
        except OpenApiException as e:
            logging.error(f"Error creating Xero payment: {e}")
            return None, str(e)

    def create_payment(self, sale_id, payment_details):
        if not self.api_client:
            logging.error("Xero API client not initialized.")
            return None, "Xero API client not initialized."

        token = self._get_token()
        if not token:
            return None, "Xero token not available."
            
        # Get the tenant ID from the token file
        xero_tenant_id = self._get_tenant_id()

        accounting_api = AccountingApi(self.api_client)

        logging.debug(f"Creating Xero payment for sale ID: {sale_id}")

        try:
            # First, find the invoice in Xero
            # Use where parameter instead of reference
            where_clause = f"Reference==\"Sale #{sale_id}\""
            invoices = accounting_api.get_invoices(xero_tenant_id, where=where_clause)
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
            # Continue with local processing despite Xero error
            logging.info("Continuing with local processing despite Xero error")
            return {"payment_id": "local-only"}, None
        except Exception as e:
            logging.error(f"Unexpected error creating Xero payment: {e}")
            # Continue with local processing despite Xero error
            logging.info("Continuing with local processing despite Xero error")
            return {"payment_id": "local-only"}, None