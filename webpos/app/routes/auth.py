from flask import Blueprint, request, redirect, current_app
import os
import json
from xero_python.api_client import ApiClient
from xero_python.api_client.configuration import Configuration
from xero_python.api_client.oauth2 import OAuth2
from xero_python.identity import build_identity_api

bp = Blueprint('auth', __name__)

@bp.route('/login')
def login():
    try:
        with open(os.path.join(os.path.dirname(current_app.root_path), '..', 'xero_credentials.json')) as f:
            xero_credentials = json.load(f)
    except FileNotFoundError:
        return "xero_credentials.json not found.", 500

    api_client = ApiClient(
        Configuration(
            debug=True,
            oauth2_token=OAuth2(**xero_credentials)
        )
    )

    return redirect(api_client.get_oauth2_authorize_url())

@bp.route('/callback')
def callback():
    try:
        with open(os.path.join(os.path.dirname(current_app.root_path), '..', 'xero_credentials.json')) as f:
            xero_credentials = json.load(f)
    except FileNotFoundError:
        return "xero_credentials.json not found.", 500

    api_client = ApiClient(
        Configuration(
            debug=True,
            oauth2_token=OAuth2(**xero_credentials)
        )
    )
    
    token = api_client.get_oauth2_token(request.url)

    identity_api = build_identity_api(api_client)
    for connection in identity_api.get_connections():
        if connection.tenant_type == "ORGANISATION":
            token['xero_tenant_id'] = connection.tenant_id
            break
    
    with open(os.path.join(os.path.dirname(current_app.root_path), '..', 'xero_token.json'), 'w') as f:
        json.dump(token, f)

    return "Successfully authenticated with Xero. You can close this window." 