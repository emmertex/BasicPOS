import { apiCall } from './apiService.js';
import { showToast } from './toastService.js';
import { state } from './uiState.js';
import { openVariantSelectionModal } from './itemService.js';

// DOM Elements
let combinationItemModal;
let combinationItemIdInput;
let combinationItemTitleInput;
let combinationItemDescriptionInput;
let componentItemSelect;
let componentQuantityInput;
let addComponentButton;
let componentsList;
let submitCombinationItemButton;
let closeCombinationItemModalButton;
let openCombinationItemModalButton;
let combinationItemModalLabel;

// State
let currentComponents = [];
let editingCombinationBaseItemId = null; // To store the ID of the item if editing

export function initCombinationItemService() {
    console.log('Initializing Combination Item Service');
    
    // Initialize DOM elements
    combinationItemModal = document.getElementById('combination-item-modal');
    combinationItemIdInput = document.getElementById('combination-item-id');
    combinationItemTitleInput = document.getElementById('combination-item-title');
    combinationItemDescriptionInput = document.getElementById('combination-item-description');
    componentItemSelect = document.getElementById('component-item-select');
    componentQuantityInput = document.getElementById('component-quantity');
    addComponentButton = document.getElementById('add-component-button');
    componentsList = document.getElementById('combination-components-list');
    submitCombinationItemButton = document.getElementById('submit-combination-item-button');
    closeCombinationItemModalButton = document.getElementById('close-combination-item-modal');
    openCombinationItemModalButton = document.getElementById('open-combination-item-modal-button');
    combinationItemModalLabel = document.getElementById('combinationItemModalLabel');

    // Add event listeners
    if (openCombinationItemModalButton) {
        openCombinationItemModalButton.addEventListener('click', openCombinationItemModal);
    }
    if (closeCombinationItemModalButton) {
        closeCombinationItemModalButton.addEventListener('click', closeCombinationItemModal);
    }
    if (addComponentButton) {
        addComponentButton.addEventListener('click', handleAddComponentButtonClick);
    }
    if (submitCombinationItemButton) {
        submitCombinationItemButton.addEventListener('click', saveCombinationItem);
    }

    // Add search functionality
    const searchInput = document.getElementById('combination-item-search');
    if (searchInput) {
        console.log('Setting up search input listener');
        searchInput.addEventListener('input', debounce(searchItems, 300));
    } else {
        console.error('Search input element not found');
    }

    // Load items for component selection
    // loadItemsForComponentSelection(); // Commenting out if primary component adding is via search
}

// Debounce function to prevent too many API calls
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// This function might not be needed if component selection is purely through search now
/*
async function loadItemsForComponentSelection() {
    try {
        const items = await apiCall('/items/');
        if (items && componentItemSelect) {
            componentItemSelect.innerHTML = '<option value="">Select an item...</option>';
            items.filter(item => item.parent_id !== -3).forEach(item => { // Original filter
                const option = document.createElement('option');
                option.value = item.id;
                option.textContent = `${item.title} (${item.sku || 'No SKU'})`;
                componentItemSelect.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Error loading items for component selection:', error);
        showToast('Error loading items for component selection', 'error');
    }
}
*/

export async function openCombinationItemModal(baseItemIdForEdit = null) {
    if (combinationItemModal) {
        // Clear previous search results and input for component search
        const searchInput = document.getElementById('combination-item-search');
        const searchResults = document.getElementById('combination-item-search-results');
        if (searchInput) searchInput.value = '';
        if (searchResults) searchResults.innerHTML = '';
        if (componentQuantityInput) componentQuantityInput.value = '1';

        if (baseItemIdForEdit) {
            editingCombinationBaseItemId = baseItemIdForEdit;
            combinationItemIdInput.value = baseItemIdForEdit; // Store the base item ID
            console.log("Opening combination item modal for EDIT, base Item ID:", baseItemIdForEdit);
            try {
                showToast('Loading combination item details for editing...', 'info', 2000);
                const comboDetails = await apiCall(`/combination-items/${baseItemIdForEdit}`);
                if (comboDetails && comboDetails.success) {
                    combinationItemTitleInput.value = comboDetails.title || '';
                    combinationItemDescriptionInput.value = comboDetails.description || '';
                    
                    currentComponents = comboDetails.components.map(comp => ({
                        item_id: String(comp.item_id),
                        title: comp.title,
                        quantity: comp.quantity
                    }));
                    
                    if (combinationItemModalLabel) combinationItemModalLabel.textContent = 'Edit Combination Item';
                    if (submitCombinationItemButton) submitCombinationItemButton.textContent = 'Update Combination Item';
                } else {
                    showToast(`Failed to load details for combination item ID ${baseItemIdForEdit}. Opening blank form.`, 'error');
                    console.error('Failed to fetch combination item details:', comboDetails);
                    editingCombinationBaseItemId = null;
                    combinationItemIdInput.value = '';
                    combinationItemTitleInput.value = '';
                    combinationItemDescriptionInput.value = '';
                    currentComponents = [];
                    if (combinationItemModalLabel) combinationItemModalLabel.textContent = 'Create Combination Item';
                    if (submitCombinationItemButton) submitCombinationItemButton.textContent = 'Save Combination Item';
                }
            } catch (error) {
                showToast(`Error loading combination item: ${error.message}. Opening blank form.`, 'error');
                console.error('Error fetching combination item for edit:', error);
                editingCombinationBaseItemId = null;
                combinationItemIdInput.value = '';
                combinationItemTitleInput.value = '';
                combinationItemDescriptionInput.value = '';
                currentComponents = [];
                if (combinationItemModalLabel) combinationItemModalLabel.textContent = 'Create Combination Item';
                if (submitCombinationItemButton) submitCombinationItemButton.textContent = 'Save Combination Item';
            }
        } else {
            editingCombinationBaseItemId = null;
            combinationItemIdInput.value = '';
            combinationItemTitleInput.value = '';
            combinationItemDescriptionInput.value = '';
            currentComponents = [];
            if (combinationItemModalLabel) combinationItemModalLabel.textContent = 'Create Combination Item';
            if (submitCombinationItemButton) submitCombinationItemButton.textContent = 'Save Combination Item';
            console.log("Opening combination item modal for NEW item.");
        }
        
        updateComponentsList();
        combinationItemModal.style.display = 'block';
    }
}

function closeCombinationItemModal() {
    if (combinationItemModal) {
        combinationItemModal.style.display = 'none';
    }
}

function addVerifiedComponentToComboList(itemData, quantity) {
    if (!itemData || itemData.id === undefined) {
        showToast('Invalid item data for component.', 'error');
        console.error("addVerifiedComponentToComboList: Invalid itemData", itemData);
        return;
    }
    const itemId = String(itemData.id); // Ensure item_id is a string for comparison if needed
    const itemTitle = itemData.title;

    const existingComponent = currentComponents.find(c => String(c.item_id) === itemId);
    if (existingComponent) {
        existingComponent.quantity += quantity;
    } else {
        currentComponents.push({
            item_id: itemId,
            title: itemTitle,
            quantity: quantity
            // Potentially store more itemData if needed by saveCombinationItem later (e.g., price if combos have dynamic pricing)
        });
    }
    
    // Reset inputs after component is added
    const searchInput = document.getElementById('combination-item-search');
    const searchResults = document.getElementById('combination-item-search-results');
    if (searchInput) searchInput.value = '';
    if (searchResults) searchResults.innerHTML = '';
    if (componentQuantityInput) componentQuantityInput.value = '1';
    
    updateComponentsList();
}

async function handleAddComponentButtonClick() {
    const selectedItemDiv = document.querySelector('#combination-item-search-results .search-result-item.selected');
    const quantity = parseInt(componentQuantityInput.value);

    if (!selectedItemDiv) {
        showToast('Please select an item from the search results.', 'warning');
        return;
    }
    if (isNaN(quantity) || quantity < 1) {
        showToast('Please enter a valid quantity.', 'warning');
        componentQuantityInput.focus();
        return;
    }

    // Retrieve all data from the selected item's dataset
    const selectedItemData = { ...selectedItemDiv.dataset }; // Create a mutable copy
    selectedItemData.id = parseInt(selectedItemData.itemId, 10); // Ensure ID is a number
    selectedItemData.parent_id = parseInt(selectedItemData.itemParentId, 10);
    // Price might be needed if variant modal expects it, or for other logic.
    // Dataset values are strings, ensure conversion if numeric type expected.
    selectedItemData.price = selectedItemData.itemPrice ? parseFloat(selectedItemData.itemPrice) : null;


    if (selectedItemData.parent_id === -1) { // Standalone item
        addVerifiedComponentToComboList({
            id: selectedItemData.id,
            title: selectedItemData.itemTitle,
            // pass other relevant fields from selectedItemData if needed by addVerifiedComponentToComboList
        }, quantity);
    } else if (selectedItemData.parent_id === -2) { // Parent item
        // Construct parentItem object for the modal
        const parentItemPayload = {
            id: selectedItemData.id,
            title: selectedItemData.itemTitle,
            sku: selectedItemData.itemSku,
            price: selectedItemData.price, // May be null for parents
            parent_id: selectedItemData.parent_id,
            description: selectedItemData.itemDescription,
            photos: selectedItemData.itemPhotos ? JSON.parse(selectedItemData.itemPhotos) : [] // Assuming photos are stored as JSON string
        };

        await openVariantSelectionModal(
            parentItemPayload,
            (chosenVariant) => { // This is the onItemSelectedCallback
                if (chosenVariant && chosenVariant.id !== undefined) {
                     // Ensure chosenVariant has at least id and title for the component list
                    addVerifiedComponentToComboList({
                        id: chosenVariant.id,
                        title: chosenVariant.title,
                        // Potentially: price: chosenVariant.price, sku: chosenVariant.sku etc.
                    }, quantity);
                } else {
                    showToast('No variant selected or variant data incomplete.', 'warning');
                }
            },
            { // Configuration for the variant modal
                showAddParentButton: false, // Don't allow adding the parent itself as component
                actionButtonText: 'Select Variant as Component', // Customize button text
                // parentItemData: parentItemPayload, // Already passed as first arg
                modalTitlePrefix: `Select Component from ${selectedItemData.itemTitle}: `,
            }
        );
    } else {
        showToast('Selected item type cannot be added as a component directly.', 'error');
        console.error("Selected item is neither standalone nor parent:", selectedItemData);
    }
}

function removeComponent(itemId) {
    currentComponents = currentComponents.filter(c => c.item_id !== itemId);
    updateComponentsList();
}

function updateComponentsList() {
    if (componentsList) {
        componentsList.innerHTML = '';
        
        currentComponents.forEach(component => {
            const componentDiv = document.createElement('div');
            componentDiv.className = 'combination-component-item';
            componentDiv.innerHTML = `
                <div class="component-info">
                    <div class="component-title">${component.title}</div>
                    <div class="component-quantity">Quantity: ${component.quantity}</div>
                </div>
                <button class="remove-component" data-item-id="${component.item_id}">Remove</button>
            `;
            
            const removeButton = componentDiv.querySelector('.remove-component');
            removeButton.addEventListener('click', () => removeComponent(component.item_id));
            
            componentsList.appendChild(componentDiv);
        });
    }
}

async function saveCombinationItem() {
    const titleInput = document.getElementById('combination-item-title');
    const descriptionInput = document.getElementById('combination-item-description');
    const baseItemId = combinationItemIdInput.value; // Get the ID from the hidden input

    const title = titleInput.value.trim();
    const description = descriptionInput.value.trim();
    // Ensure components are in the format expected by the backend (item_id, quantity)
    const componentsToSave = currentComponents.map(c => ({
        item_id: parseInt(c.item_id, 10), // Ensure item_id is an integer
        quantity: c.quantity
    }));

    if (!title) {
        showToast('Please enter a title for the combination item', 'error');
        return;
    }

    if (componentsToSave.length === 0) {
        showToast('Please add at least one component to the combination item', 'error');
        return;
    }

    try {
        const formData = new FormData();
        formData.append('title', title);
        formData.append('description', description);
        formData.append('components', JSON.stringify(componentsToSave));
        
        let response;
        if (baseItemId) { // If there's an ID, it's an update (PUT)
            console.log(`Attempting to UPDATE combination item with base Item ID: ${baseItemId}`);
            response = await apiCall(`/combination-items/${baseItemId}`, 'PUT', formData);
        } else { // No ID, it's a new item (POST)
            console.log("Attempting to CREATE new combination item");
            response = await apiCall('/combination-items', 'POST', formData);
        }

        if (response && response.success) { // Backend now returns success:true and id for POST too
            showToast(`Combination item ${baseItemId ? 'updated' : 'created'} successfully`, 'success');
            closeCombinationItemModal();
            // Optionally refresh the main items list or update the UI as needed
            if (typeof window.searchItems === 'function') { // Check if global searchItems exists
                window.searchItems(); // Call if you want to refresh main item search
            } else if (typeof preloadItems === 'function') { // Fallback to preloadItems if available
                 preloadItems(); // from itemService.js to refresh cache
            }
        } else {
            // apiCall should show specific errors for network/backend issues
            // This handles cases where response exists but success is not true
            const message = response && response.message ? response.message : 'Failed to save combination item.';
            showToast(message, 'error');
            console.error("Save combination item failed, response:", response);
        }
    } catch (error) {
        console.error('Error saving combination item:', error);
        showToast('Error saving combination item: ' + error.message, 'error');
    }
}

async function searchItems() {
    console.log('Search function called for combination item components');
    const searchInput = document.getElementById('combination-item-search');
    const searchResults = document.getElementById('combination-item-search-results');
    
    if (!searchInput || !searchResults) {
        console.error('Search elements not found:', { searchInput, searchResults });
        return;
    }

    const query = searchInput.value.trim();
    if (!query) {
        searchResults.innerHTML = '';
        return;
    }

    try {
        console.log('Making API call to /items/ with include_variants:true');
        // Backend with include_variants:true now returns direct matches of types -1, -2, >0
        const items = await apiCall('/items/', 'GET', null, { 
            q: query,
            include_variants: 'true', 
            is_current_version: '1',
            is_active: '1'
        });
        
        searchResults.innerHTML = '';

        if (items && items.length > 0) {
            // Filter for display: only standalones (-1) and parents (-2)
            const displayableItems = items.filter(item => item.parent_id === -1 || item.parent_id === -2);
            console.log('Displayable items in combo component search (standalones -1, parents -2):', displayableItems);
            
            if (displayableItems.length === 0) {
                searchResults.innerHTML = '<div class="search-result-item">No suitable items (standalones or parents) found matching your search.</div>';
                return;
            }

            displayableItems.forEach(item => {
                const div = document.createElement('div');
                div.className = 'search-result-item';
                // Display logic:
                let displayText = `${item.title} (${item.sku || 'No SKU'})`;
                if (item.parent_id === -2) {
                    displayText += " [Parent - Click to select variant]";
                } else if (item.price !== null && item.price !== undefined) {
                    displayText += ` - $${parseFloat(item.price).toFixed(2)}`;
                }


                div.textContent = displayText;
                // Store all necessary data for later use
                div.dataset.itemId = item.id;
                div.dataset.itemTitle = item.title;
                div.dataset.itemPrice = item.price !== null && item.price !== undefined ? String(item.price) : '';
                div.dataset.itemSku = item.sku || '';
                div.dataset.itemParentId = String(item.parent_id);
                div.dataset.itemDescription = item.description || '';
                div.dataset.itemPhotos = item.photos ? JSON.stringify(item.photos) : '[]'; // For variant modal if needed

                
                div.addEventListener('click', () => {
                    // Just handle visual selection
                    document.querySelectorAll('#combination-item-search-results .search-result-item').forEach(el => {
                        el.classList.remove('selected');
                    });
                    div.classList.add('selected');
                    console.log('Visually selected item for component consideration:', item.title, `(Parent ID: ${item.parent_id})`);
                });
                
                searchResults.appendChild(div);
            });
        } else {
            searchResults.innerHTML = '<div class="search-result-item">No items found matching your search.</div>';
        }
    } catch (error) {
        console.error('Error searching items for combo components:', error);
        searchResults.innerHTML = '<div class="search-result-item">Error searching items.</div>';
    }
} 