from app import create_app, db # Assuming app structure within web_frontend

app = create_app('config_web.ConfigWeb') # Use the new config

if __name__ == '__main__':
    with app.app_context():
        # For a read-only frontend, we typically don't need to create tables or seed data here.
        # We assume the main application manages the database schema and initial data.
        # db.create_all() # Usually not needed for a read-only replica
        pass

    app.run(
        host='0.0.0.0',
        port=5001,       # Different port for the web frontend
        debug=True,
        threaded=True
    ) 