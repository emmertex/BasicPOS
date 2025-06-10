from flask import Blueprint, request, redirect, current_app, url_for
import os
import json
import urllib.parse
import requests
from xero_python.api_client import ApiClient
from xero_python.api_client.configuration import Configuration
from xero_python.api_client.oauth2 import OAuth2Token
from xero_python.identity import IdentityApi
from xero_python.exceptions import OpenApiException

bp = Blueprint('auth', __name__)

@bp.route('/login')
def login():
    try:
        with open(os.path.join(os.path.dirname(current_app.root_path), 'xero_credentials.json')) as f:
            xero_credentials = json.load(f)
    except FileNotFoundError:
        current_app.logger.error("xero_credentials.json not found.")
        return "xero_credentials.json not found.", 500
    except Exception as e:
        current_app.logger.error(f"Error reading xero_credentials.json: {e}")
        return "Error reading Xero credentials.", 500

    # Extract credentials
    client_id = xero_credentials.get('client_id')
    redirect_uri = xero_credentials.get('redirect_uri')
    scopes = xero_credentials.get('scopes', 'openid profile email accounting.transactions accounting.contacts offline_access')
    
    # Build authorization URL manually
    auth_url = "https://login.xero.com/identity/connect/authorize"
    params = {
        'response_type': 'code',
        'client_id': client_id,
        'redirect_uri': redirect_uri,
        'scope': scopes,
        'state': 'random_state_string'  # Should be a random string for security
    }
    
    auth_url = auth_url + '?' + urllib.parse.urlencode(params)
    
    return redirect(auth_url)

@bp.route('/callback')
def callback():
    try:
        with open(os.path.join(os.path.dirname(current_app.root_path), 'xero_credentials.json')) as f:
            xero_credentials = json.load(f)
    except FileNotFoundError:
        current_app.logger.error("xero_credentials.json not found.")
        return "xero_credentials.json not found.", 500
    except Exception as e:
        current_app.logger.error(f"Error reading xero_credentials.json: {e}")
        return "Error reading Xero credentials.", 500

    # Get the authorization code from the request
    code = request.args.get('code')
    if not code:
        current_app.logger.error("Authorization code not found in the request.")
        return "Authorization code not found in the request.", 400
    
    # Check for error in the callback
    if request.args.get('error'):
        error = request.args.get('error')
        error_description = request.args.get('error_description', 'No description provided')
        current_app.logger.error(f"Xero authorization error: {error} - {error_description}")
        return f"Authorization failed: {error_description}", 400
    
    # Extract credentials
    client_id = xero_credentials.get('client_id')
    client_secret = xero_credentials.get('client_secret')
    redirect_uri = xero_credentials.get('redirect_uri')
    
    # Exchange the code for a token
    token_url = "https://identity.xero.com/connect/token"
    token_data = {
        'grant_type': 'authorization_code',
        'code': code,
        'redirect_uri': redirect_uri
    }
    
    try:
        # Exchange the authorization code for a token
        response = requests.post(
            token_url,
            data=token_data,
            auth=(client_id, client_secret),
            headers={'Content-Type': 'application/x-www-form-urlencoded'}
        )
        
        if response.status_code != 200:
            current_app.logger.error(f"Token exchange failed: {response.status_code} - {response.text}")
            return "Failed to exchange authorization code for token.", 500
            
        token = response.json()
        current_app.logger.info("Successfully obtained token from Xero")

    except Exception as e:
        current_app.logger.error(f"Error during token exchange: {e}")
        return "Failed to exchange authorization code for token.", 500
    
    # Try to get tenant ID
    tenant_id = None
    try:
        # Define getter and saver for the temporary ApiClient
        def token_getter():
            return token

        def token_saver(new_token):
            nonlocal token
            token = new_token

        # Create a new API client with the token to get the tenant ID
        config = Configuration(
            oauth2_token=OAuth2Token(client_id=client_id, client_secret=client_secret)
        )
        api_client_for_identity = ApiClient(
            configuration=config,
            oauth2_token_getter=token_getter,
            oauth2_token_saver=token_saver
        )
        
        # Get the tenant connections
        identity_api = IdentityApi(api_client_for_identity)
        connections = identity_api.get_connections()
        
        if connections and len(connections) > 0:
            tenant_id = connections[0].tenant_id
            current_app.logger.info(f"Successfully retrieved tenant ID: {tenant_id}")
        else:
            current_app.logger.warning("No Xero tenants connected for this user.")
            return "No Xero tenants found for your account.", 400
            
    except OpenApiException as e:
        current_app.logger.error(f"Error retrieving tenant ID from Xero: {e}")
        return "Error communicating with Xero to get tenant ID.", 500
    except Exception as e:
        current_app.logger.error(f"Unexpected error retrieving tenant ID: {e}")
        return "An unexpected error occurred while getting the tenant ID.", 500
    
    # Store the token and tenant ID
    token_data = {
        'token': token,
        'tenant_id': tenant_id
    }
    
    # Save the token and tenant ID
    try:
        with open(os.path.join(os.path.dirname(current_app.root_path), 'xero_token.json'), 'w') as f:
            json.dump(token_data, f)
        current_app.logger.info("Xero token and tenant ID saved successfully.")
    except Exception as e:
        current_app.logger.error(f"Error saving Xero token: {e}")
        return "Error saving Xero token.", 500

    # Redirect to the home page or a success page
    return redirect(url_for('serve_index')) 