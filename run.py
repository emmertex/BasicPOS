from app import create_app, db

app = create_app()

if __name__ == '__main__':
    with app.app_context():
        # This is a good place to ensure all tables are created,
        # especially during development. For production, migrations are preferred.
        db.create_all()
        
        # You could also add some seed data here if needed for QuickAddItems
        from app.models import QuickAddItem, Item # Import models for seeding

        # Example of seeding quick add items if the table is empty
        if not QuickAddItem.query.first():
            print("Seeding initial QuickAddItems...")
            # Try to find some existing items to link to
            sample_item1 = Item.query.first()
            sample_item2 = Item.query.offset(1).first()

            quick_adds_to_seed = []
            # Page 1: Some items and a link to page 2
            if sample_item1:
                quick_adds_to_seed.append(QuickAddItem(page_number=1, position=0, type='item', label=sample_item1.title[:20], item_id=sample_item1.id, color='#A0E7E5'))
            else:
                 quick_adds_to_seed.append(QuickAddItem(page_number=1, position=0, type='item', label='Sample Item 1', item_id=None, color='#A0E7E5')) # Placeholder if no items

            if sample_item2:
                quick_adds_to_seed.append(QuickAddItem(page_number=1, position=1, type='item', label=sample_item2.title[:20], item_id=sample_item2.id, color='#A0E7E5'))
            else:
                quick_adds_to_seed.append(QuickAddItem(page_number=1, position=1, type='item', label='Sample Item 2', item_id=None, color='#A0E7E5')) # Placeholder
            
            quick_adds_to_seed.append(QuickAddItem(page_number=1, position=2, type='page_link', label='More Items >', target_page_number=2, color='#FFAEBC'))
            quick_adds_to_seed.append(QuickAddItem(page_number=1, position=3, type='page_link', label='Drinks Page >', target_page_number=3, color='#B4F8C8'))

            # Page 2: Example items
            quick_adds_to_seed.append(QuickAddItem(page_number=2, position=0, type='item', label='Item A on P2', item_id=None, color='#FBE7C6')) # No actual item linked for now
            quick_adds_to_seed.append(QuickAddItem(page_number=2, position=1, type='item', label='Item B on P2', item_id=None, color='#FBE7C6'))
            quick_adds_to_seed.append(QuickAddItem(page_number=2, position=2, type='page_link', label='< Back to P1', target_page_number=1, color='#FFAEBC'))

            # Page 3: Example items (Drinks)
            quick_adds_to_seed.append(QuickAddItem(page_number=3, position=0, type='item', label='Cola', item_id=None, color='#AED9E0'))
            quick_adds_to_seed.append(QuickAddItem(page_number=3, position=1, type='item', label='Juice', item_id=None, color='#AED9E0'))
            quick_adds_to_seed.append(QuickAddItem(page_number=3, position=2, type='page_link', label='< Back to P1', target_page_number=1, color='#FFAEBC'))

            try:
                db.session.bulk_save_objects(quick_adds_to_seed)
                db.session.commit()
                print(f"{len(quick_adds_to_seed)} QuickAddItems seeded.")
            except Exception as e:
                db.session.rollback()
                print(f"Error seeding QuickAddItems: {e}")

    app.run(debug=True) 