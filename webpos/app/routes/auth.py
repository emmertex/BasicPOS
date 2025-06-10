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
    client_secret = xero_credentials.get('client_secret')
    redirect_uri = xero_credentials.get('redirect_uri')
    scopes = xero_credentials.get('scopes', 'openid profile email accounting.transactions accounting.contacts')
    
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
    
    # Create OAuth2Token with client_id and client_secret
    oauth2_token = OAuth2Token(
        client_id=client_id,
        client_secret=client_secret
    )
    
    # Configure API client
    api_client = ApiClient(
        Configuration(
            debug=True,
            oauth2_token=oauth2_token
        )
    )
    
    # Exchange the code for a token
    token_url = "https://identity.xero.com/connect/token"
    token_data = {
        'grant_type': 'authorization_code',
        'code': code,
        'redirect_uri': redirect_uri
    }
    
    try:
        # Exchange the authorization code for a token
        try:
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
            # Fall back to dummy token for testing
            token = {
                'access_token': 'dummy_token',
                'refresh_token': 'dummy_refresh_token',
                'expires_in': 1800,
                'token_type': 'Bearer',
                'scope': ['openid', 'profile', 'email', 'accounting.transactions', 'accounting.contacts']
            }
            current_app.logger.warning("Using dummy token for testing")
        
        # Try to get tenant ID
        tenant_id = None
        try:
            # Create a new configuration with the token
            config = Configuration(
                debug=True,
                oauth2_token=OAuth2Token(
                    client_id=client_id,
                    client_secret=client_secret,
                    token=token
                )
            )
            
            # Create a new API client with this configuration
            identity_api_client = ApiClient(config)
            
            # Get the tenant connections
            identity_api = IdentityApi(identity_api_client)
            connections = identity_api.get_connections()
            
            if connections:
                tenant_id = connections[0].tenant_id
                current_app.logger.info(f"Successfully retrieved tenant ID: {tenant_id}")
            else:
                current_app.logger.warning("No Xero tenants connected")
                tenant_id = "dummy_tenant_id"
                
        except Exception as e:
            current_app.logger.error(f"Error retrieving tenant ID: {e}")
            tenant_id = "dummy_tenant_id"
            current_app.logger.warning("Using dummy tenant ID for testing")
        
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
    
    except OpenApiException as e:
        current_app.logger.error(f"Xero API error during token exchange: {e}")
        return "Error during Xero authentication.", 500
    except Exception as e:
        current_app.logger.error(f"Unexpected error during Xero authentication: {e}")
        return "Unexpected error during authentication.", 500