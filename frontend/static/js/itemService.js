import { apiCall } from './apiService.js';
import { showToast } from './toastService.js';
import { state } from './uiState.js';
import { addItemToCart } from './cart.js'; // For adding items/variants to cart
import {
    collapseQuickAddDashboard,
    expandQuickAddDashboard,
    expandItemSearchResults,
    collapseItemSearchResults
} from './panelUtils.js';

// --- DOM Element Selectors (will be initialized in initItemService) ---
// Item Search
let itemSearchInput;
let itemSearchResultsDiv;

// Add/Edit Item Modal
let addEditItemModal;
let itemModalTitle;
let editItemIdInput;
let itemTitleInput;
let itemSkuInput;
let itemPriceInput;
let itemStockQuantityInput;
let itemDescriptionInput;
let itemParentIdInput;
let itemIsStockTrackedCheckbox;
let itemShowOnWebsiteCheckbox;
let itemIsActiveCheckbox;
let itemImagesUploadInput;
let itemImagesListDiv;
let manageVariantsButton;
let itemImageDropZone;

// Variant Selection Modal
let variantSelectionModal;
let variantModalTitle;
let variantListContainer;

// Image Preview Modal
let imagePreviewModal;
let imagePreviewModalTitle;
let imagePreviewModalImage;

export function initItemService() {
    // Item Search
    itemSearchInput = document.getElementById('item-search-input');
    itemSearchResultsDiv = document.getElementById('item-search-results');

    // Add/Edit Item Modal
    addEditItemModal = document.getElementById('add-edit-item-modal');
    itemModalTitle = document.getElementById('item-modal-title');
    editItemIdInput = document.getElementById('edit-item-id');
    itemTitleInput = document.getElementById('item-title');
    itemSkuInput = document.getElementById('item-sku');
    itemPriceInput = document.getElementById('item-price');
    itemStockQuantityInput = document.getElementById('item-stock-quantity');
    itemDescriptionInput = document.getElementById('item-description');
    itemParentIdInput = document.getElementById('item-parent-id');
    itemIsStockTrackedCheckbox = document.getElementById('item-is-stock-tracked');
    itemShowOnWebsiteCheckbox = document.getElementById('item-show-on-website');
    itemIsActiveCheckbox = document.getElementById('item-is-active');
    itemImagesUploadInput = document.getElementById('item-images-upload');
    itemImagesListDiv = document.getElementById('item-images-list');
    manageVariantsButton = document.getElementById('manage-variants-button');
    itemImageDropZone = document.getElementById('item-image-drop-zone');

    // Variant Selection Modal
    variantSelectionModal = document.getElementById('variant-selection-modal');
    variantModalTitle = document.getElementById('variant-modal-title');
    variantListContainer = document.getElementById('variant-list-container');

    // Image Preview Modal
    imagePreviewModal = document.getElementById('imagePreviewModal');
    imagePreviewModalTitle = document.getElementById('imagePreviewModalTitle');
    imagePreviewModalImage = document.getElementById('imagePreviewModalImage');
    
    // Initial setup that depends on DOM elements being ready
    setupItemImageDropZone(); 

    // Delegated listener for deleting images within item modal
    if (itemImagesListDiv) {
        itemImagesListDiv.addEventListener('click', function(event) {
            if (event.target.classList.contains('delete-image-btn')) {
                const photoId = event.target.dataset.photoId;
                // editItemIdInput is available within this module scope after initItemService runs
                if (editItemIdInput && editItemIdInput.value && photoId) {
                    handleDeleteImage(editItemIdInput.value, photoId);
                } else {
                    showToast('Cannot delete image: Item ID or Photo ID missing.', 'error');
                    console.warn("Could not get editItemIdInput.value for handleDeleteImage from itemService listener");
                }
            }
            // Placeholder for set-primary-image-btn if implemented
        });
    }
}

// --- Item Search --- 
export async function preloadItems() {
    const allItems = await apiCall('/items/');
    if (allItems) {
        state.itemsCache = allItems;
        console.log("Items preloaded for search:", state.itemsCache.length);
    }
}

export async function searchItems() {
    if (!itemSearchInput || !itemSearchResultsDiv) return;
    const query = itemSearchInput.value.trim();

    if (query) {
        collapseQuickAddDashboard();
    } else {
        expandQuickAddDashboard();
    }

    if (!query) {
        itemSearchResultsDiv.innerHTML = '';
        collapseItemSearchResults();
        return;
    }

    if (state.itemsCache.length === 0) {
        await preloadItems(); // Ensure items are loaded if cache is empty
    }

    const lowerCaseQuery = query.toLowerCase();
    const results = state.itemsCache.filter(item => 
        (item.title && item.title.toLowerCase().includes(lowerCaseQuery)) || 
        (item.sku && item.sku.toLowerCase().includes(lowerCaseQuery))
    );

    itemSearchResultsDiv.innerHTML = '';
    if (results.length > 0) {
        results.forEach(item => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'item-search-result-rich';

            const imageUrl = (item.photos && item.photos.length > 0 && item.photos[0].small_url) 
                ? item.photos[0].small_url 
                : 'https://via.placeholder.com/100x100.png?text=No+Image';
            const largeImageUrl = (item.photos && item.photos.length > 0 && item.photos[0].large_url) 
                ? item.photos[0].large_url 
                : imageUrl;

            let detailsSideHTML = '';
            if (item.parent_id === -2) { // Is a parent item with variants
                detailsSideHTML = `
                    <p class="view-variants-text">View Variants</p>
                    <button class="edit-item-from-search-btn btn btn-primary pure-button">Edit</button>
                `;
            } else {
                detailsSideHTML = `
                    <p class="item-price-search">$${item.price ? item.price.toFixed(2) : 'N/A'}</p>
                    <p class="item-stock-search">Stock: ${item.is_stock_tracked ? item.stock_quantity : 'Not Tracked'}</p>
                    <div class="item-search-actions" style="display: flex; gap: 5px; margin-top: 5px;">
                        <button class="edit-item-from-search-btn btn btn-primary pure-button">Edit</button>
                        <button class="print-label-btn btn btn-warning pure-button">Print Label</button>
                    </div>
                `;
            }

            itemDiv.innerHTML = `
                <div class="item-image-container">
                    <img src="${imageUrl}" alt="${item.title}" class="item-image-preview-trigger">
                </div>
                <div class="item-details-main">
                    <h3 class="item-title-search">${item.title}</h3>
                    <p class="item-sku-id-search">SKU: ${item.sku || 'N/A'} ID: ${item.id}</p>
                    <p class="item-description-search">${item.description ? (item.description.length > 100 ? item.description.substring(0, 97) + '...' : item.description) : 'No description.'}</p>
                </div>
                <div class="item-details-side">
                    ${detailsSideHTML}
                </div>
            `;

            const imageElement = itemDiv.querySelector('.item-image-preview-trigger');
            if (imageElement) {
                imageElement.addEventListener('click', (e) => {
                    e.stopPropagation();
                    openImagePreviewModal(largeImageUrl, item.title);
                });
            }

            const editButton = itemDiv.querySelector('.edit-item-from-search-btn');
            if (editButton) {
                editButton.addEventListener('click', (e) => {
                    e.stopPropagation();
                    openEditItemForm(item.id);
                });
            }

            const printLabelButton = itemDiv.querySelector('.print-label-btn');
            if (printLabelButton) {
                printLabelButton.addEventListener('click', (e) => {
                    e.stopPropagation(); // Prevent triggering the itemDiv click (add to cart/variants)
                    // Action: Open new tab for label printing
                    window.open(`/print/label/${item.id}`, '_blank');
                    showToast(`Opening label print page for ${item.title}...`, 'info');
                });
            }

            itemDiv.addEventListener('click', () => {
                // Visual feedback for selection
                const currentlySelected = itemSearchResultsDiv.querySelector('.item-search-result-rich.selected');
                if (currentlySelected) {
                    currentlySelected.classList.remove('selected');
                }
                itemDiv.classList.add('selected');

                if (item.parent_id === -2) { // Is a parent item
                    // Define the callback for adding to cart
                    const addToCartCallback = (selectedVariant) => {
                        if (selectedVariant && selectedVariant.id && selectedVariant.price !== null && selectedVariant.price !== undefined) {
                            addItemToCart(selectedVariant.id, selectedVariant.price);
                            showToast(`${selectedVariant.title} added to cart.`, 'success');
                        } else {
                            showToast('Selected variant cannot be added to cart (missing ID or price).', 'warning');
                        }
                    };
                    // Call openVariantSelectionModal with the item, the callback, and config
                    openVariantSelectionModal(item, addToCartCallback, { showAddParentButton: false, actionButtonText: "Add to Cart" });
                } else if (item.price !== null && item.price !== undefined) {
                    addItemToCart(item.id, item.price);
                } else {
                    showToast('This item cannot be added to cart (missing price or is a parent template).', 'warning');
                }
            });
            itemSearchResultsDiv.appendChild(itemDiv);
        });
        expandItemSearchResults();
    } else {
        itemSearchResultsDiv.innerHTML = '<p>No items found.</p>';
        expandItemSearchResults();
    }
}

// --- Image Preview Modal ---
export function openImagePreviewModal(imageUrl, itemTitle) {
    if (imagePreviewModal && imagePreviewModalImage && imagePreviewModalTitle) {
        imagePreviewModalTitle.textContent = itemTitle || 'Image Preview';
        imagePreviewModalImage.src = imageUrl;
        imagePreviewModal.style.display = 'block';
    } else {
        console.error("Image preview modal elements not found.");
        showToast("Could not open image preview.", "error");
    }
}

export function closeImagePreviewModal() {
    if (imagePreviewModal) {
        imagePreviewModal.style.display = 'none';
        if (imagePreviewModalImage) {
            imagePreviewModalImage.src = ''; // Clear image to free memory
        }
    }
}

// --- Variant Selection Modal ---
export async function openVariantSelectionModal(parentItem, onItemSelectedCallback, config = {}) {
    if (!variantSelectionModal || !variantModalTitle || !variantListContainer) {
        console.error("Variant modal elements not found");
        showToast("Error: Variant modal UI not available.", "error");
        return;
    }

    const modalTitlePrefix = config.modalTitlePrefix || "Select Variant for ";
    const actionButtonText = config.actionButtonText || "Add to Cart";
    const showAddParentButton = config.showAddParentButton !== undefined ? config.showAddParentButton : false; // Default to false if not specified

    variantModalTitle.textContent = `${modalTitlePrefix}${parentItem.title}`;
    variantListContainer.innerHTML = ''; // Clear previous content immediately

    // Optionally, add a button to select the parent item itself
    if (showAddParentButton) {
        const parentItemDiv = document.createElement('div');
        parentItemDiv.className = 'variant-item parent-item-selection'; // Add a distinct class for styling if needed
        parentItemDiv.innerHTML = `
            <strong>${parentItem.title}</strong> (SKU: ${parentItem.sku || 'N/A'}) - Parent
            <p><em>${parentItem.description ? (parentItem.description.length > 70 ? parentItem.description.substring(0, 67) + '...' : parentItem.description) : 'Main product/category.'}</em></p>
            <button class="select-parent-item-btn btn btn-info">${actionButtonText} Parent</button>
        `;
        parentItemDiv.querySelector('.select-parent-item-btn').addEventListener('click', () => {
            if (onItemSelectedCallback && typeof onItemSelectedCallback === 'function') {
                onItemSelectedCallback({
                    id: parentItem.id,
                    title: parentItem.title,
                    price: parentItem.price,
                    sku: parentItem.sku,
                    parent_id: parentItem.parent_id // which is -2 for a parent
                });
            }
            closeVariantSelectionModal();
        });
        variantListContainer.appendChild(parentItemDiv);
        const hr = document.createElement('hr');
        variantListContainer.appendChild(hr);
    }
    
    const loadingP = document.createElement('p');
    loadingP.textContent = 'Loading variants...';
    variantListContainer.appendChild(loadingP);
    
    variantSelectionModal.style.display = 'block';

    try {
        const variants = await apiCall(`/items/${parentItem.id}/variants`);
        loadingP.remove(); // Remove "Loading variants..."

        if (variants && variants.length > 0) {
            variants.forEach(variant => {
                const variantDiv = document.createElement('div');
                variantDiv.className = 'variant-item';
                const priceDisplay = (typeof variant.price === 'number') ? variant.price.toFixed(2) : 'N/A';
                variantDiv.innerHTML = `
                    <strong>${variant.title}</strong> (SKU: ${variant.sku || 'N/A'}) - $${priceDisplay}<br>
                    Stock: ${variant.is_stock_tracked ? variant.stock_quantity : 'Not Tracked'}
                    <button class="select-variant-btn btn btn-primary">${actionButtonText}</button>
                `;
                const selectButton = variantDiv.querySelector('.select-variant-btn');
                
                // DEBUGGING: Log if the callback is available here
                if (typeof onItemSelectedCallback !== 'function') {
                    console.warn('VariantSelectionModal: onItemSelectedCallback is NOT a function when setting up variant button for:', variant.title);
                }

                selectButton.addEventListener('click', () => {
                    if (onItemSelectedCallback && typeof onItemSelectedCallback === 'function') {
                        const itemDataForCallback = {
                            id: variant.id,
                            title: variant.title,
                            price: variant.price,
                            sku: variant.sku,
                            parent_id: variant.parent_id
                        };
                        // DEBUGGING: Log the data being sent to the callback
                        console.log('VariantSelectionModal: Calling onItemSelectedCallback with:', itemDataForCallback);
                        onItemSelectedCallback(itemDataForCallback);
                    } else {
                        console.error('VariantSelectionModal: onItemSelectedCallback is missing or not a function on click for variant:', variant.title);
                        showToast('Action could not be performed for variant.', 'error');
                    }
                    closeVariantSelectionModal();
                });
                variantListContainer.appendChild(variantDiv);
            });
        } else if (variants) { // variants is an empty array
            variantListContainer.appendChild(document.createTextNode('No variants available for this item.'));
        } else { // variants is null/undefined (error handled by apiCall)
             variantListContainer.appendChild(document.createTextNode('Could not load variants.'));
        }
    } catch (error) {
        console.error("Error fetching or displaying variants:", error);
        loadingP.remove();
        const errorP = document.createElement('p');
        errorP.textContent = 'Error loading variants. Please try again.';
        errorP.style.color = 'red';
        variantListContainer.appendChild(errorP);
        showToast("Failed to load variants.", "error");
    }
}

export function closeVariantSelectionModal() {
    if (variantSelectionModal) {
        variantSelectionModal.style.display = 'none';
    }
}

// --- Add/Edit Item Modal ---
export function clearItemModalForm() {
    if (!editItemIdInput || !itemTitleInput || !itemSkuInput || !itemPriceInput || !itemStockQuantityInput || !itemDescriptionInput || !itemParentIdInput || !itemIsStockTrackedCheckbox || !itemShowOnWebsiteCheckbox || !itemIsActiveCheckbox) {
        console.warn("clearItemModalForm: One or more input elements are not yet initialized.");
        return;
    }
    editItemIdInput.value = '';
    itemTitleInput.value = '';
    itemSkuInput.value = '';
    itemPriceInput.value = '';
    itemStockQuantityInput.value = '1';
    itemDescriptionInput.value = '';
    itemParentIdInput.value = '-1';
    itemIsStockTrackedCheckbox.checked = true;
    itemShowOnWebsiteCheckbox.checked = false;
    itemIsActiveCheckbox.checked = true;
    if (itemImagesUploadInput) itemImagesUploadInput.value = null;
    if (itemImagesListDiv) itemImagesListDiv.innerHTML = '';
    if (manageVariantsButton) {
        manageVariantsButton.style.display = 'none';
        manageVariantsButton.onclick = null; 
        manageVariantsButton.removeAttribute('data-parent-item-id'); // Clear data attribute
    }
}

export function openAddItemForm() {
    if (!addEditItemModal || !itemModalTitle) {
        console.error("openAddItemForm: Add/Edit Item Modal or its title element not found/initialized!");
        showToast("Error: Cannot open item form, UI elements missing.", "error");
        return;
    }
    clearItemModalForm();
    itemModalTitle.textContent = 'Add New Item';
    addEditItemModal.style.display = 'block';
    // Ensure manage variants button is correctly hidden for brand new items
    if (manageVariantsButton) manageVariantsButton.style.display = 'none';
}

export async function openEditItemForm(itemId) {
    if (!addEditItemModal || !itemModalTitle || !editItemIdInput || !itemTitleInput || !itemSkuInput || !itemPriceInput || !itemStockQuantityInput || !itemDescriptionInput || !itemParentIdInput || !itemIsStockTrackedCheckbox || !itemShowOnWebsiteCheckbox || !itemIsActiveCheckbox) {
        console.error("openEditItemForm: One or more modal input elements are not yet initialized!");
        showToast("Error: Cannot open edit item form, UI elements missing.", "error");
        return;
    }
    clearItemModalForm();
    itemModalTitle.textContent = 'Edit Item';
    editItemIdInput.value = itemId;

    const itemData = await apiCall(`/items/${itemId}`);
    if (itemData) {
        itemTitleInput.value = itemData.title;
        itemSkuInput.value = itemData.sku;
        itemPriceInput.value = itemData.price ? itemData.price.toFixed(2) : '';
        itemStockQuantityInput.value = itemData.stock_quantity;
        itemDescriptionInput.value = itemData.description || '';
        itemParentIdInput.value = itemData.parent_id;
        itemIsStockTrackedCheckbox.checked = itemData.is_stock_tracked;
        itemShowOnWebsiteCheckbox.checked = itemData.show_on_website;
        itemIsActiveCheckbox.checked = itemData.is_active;

        if (itemImagesListDiv) {
            itemImagesListDiv.innerHTML = '';
            if (itemData.photos && itemData.photos.length > 0) {
                itemData.photos.forEach(photo => {
                    const photoContainer = document.createElement('div');
                    photoContainer.className = 'image-preview-container';
                    photoContainer.id = `photo-preview-${photo.id}`;

                    const img = document.createElement('img');
                    img.src = photo.small_url;
                    img.alt = itemData.title + ' image';
                    img.className = 'image-preview';
                    photoContainer.appendChild(img);

                    // Placeholder for Set Primary button (logic not fully implemented here yet)
                    // const setPrimaryBtn = document.createElement('button');
                    // setPrimaryBtn.className = 'set-primary-image-btn';
                    // setPrimaryBtn.textContent = 'Set Primary';
                    // setPrimaryBtn.dataset.photoId = photo.id;
                    // photoContainer.appendChild(setPrimaryBtn);

                    if (photo.is_primary) {
                        const primaryIndicator = document.createElement('span');
                        primaryIndicator.className = 'primary-image-indicator';
                        primaryIndicator.textContent = 'Primary';
                        photoContainer.appendChild(primaryIndicator);
                    }

                    const deleteBtn = document.createElement('button');
                    deleteBtn.className = 'delete-image-btn';
                    deleteBtn.textContent = 'Delete';
                    deleteBtn.dataset.photoId = photo.id;
                    // deleteBtn.onclick will be handled by event delegation in app.js or here if we add listener
                    photoContainer.appendChild(deleteBtn);
                    itemImagesListDiv.appendChild(photoContainer);
                });
            }
        }

        if (manageVariantsButton) {
            if (itemData.parent_id === -2) { // Is a parent item
                manageVariantsButton.style.display = 'block';
                manageVariantsButton.dataset.parentItemId = itemData.id; // Store parent item ID for variant creation
                // The onclick for manageVariantsButton will be set up in app.js or here
            } else {
                manageVariantsButton.style.display = 'none';
            }
        }
        addEditItemModal.style.display = 'flex'; // Use flex if modal content uses it
    } else {
        showToast("Failed to load item details for editing.", 'error');
    }
}

export function closeAddEditItemModal() {
    if (addEditItemModal) {
        addEditItemModal.style.display = 'none';
        if (manageVariantsButton) manageVariantsButton.style.display = 'none';
    }
}

export async function handleSaveItem(addToCartAfterSave = false) {
    const itemId = editItemIdInput.value;
    const title = itemTitleInput.value.trim();
    const sku = itemSkuInput.value.trim();
    const priceText = itemPriceInput.value.trim();
    const stockQuantity = parseInt(itemStockQuantityInput.value) || 0;
    const description = itemDescriptionInput.value.trim();
    const parentId = parseInt(itemParentIdInput.value) || -1;
    const isStockTracked = itemIsStockTrackedCheckbox.checked;
    const showOnWebsite = itemShowOnWebsiteCheckbox.checked;
    const isActive = itemIsActiveCheckbox.checked;

    if (!title || !priceText) {
        showToast('Title and Price are required for item.', 'error');
        return null;
    }
    const price = parseFloat(priceText);
    if (isNaN(price)) {
        showToast('Price must be a valid number.', 'error');
        return null;
    }

    const formData = new FormData();
    formData.append('title', title);
    formData.append('sku', sku);
    formData.append('price', price.toString());
    formData.append('stock_quantity', stockQuantity.toString());
    formData.append('description', description);
    formData.append('parent_id', parentId.toString());
    formData.append('is_stock_tracked', isStockTracked ? 'true' : 'false');
    formData.append('show_on_website', showOnWebsite ? 'true' : 'false');
    formData.append('is_active', isActive ? 'true' : 'false');

    if (itemImagesUploadInput && itemImagesUploadInput.files.length > 0) {
        for (let i = 0; i < itemImagesUploadInput.files.length; i++) {
            formData.append('images', itemImagesUploadInput.files[i]);
        }
    }

    let result;
    try {
        if (itemId) {
            result = await apiCall(`/items/${itemId}`, 'PUT', formData);
        } else {
            result = await apiCall('/items/', 'POST', formData);
        }

        if (result && result.id) { // Check for a valid item object response
            showToast(itemId ? 'Item updated successfully!' : 'Item created successfully!', 'success');
            closeAddEditItemModal();
            await preloadItems(); // Refresh itemsCache
            // searchItems(); // Refresh search results if search was active - might be too broad, or could be conditional

            if (addToCartAfterSave && result.id && result.price !== null && result.price !== undefined && result.parent_id !== -2) {
                await addItemToCart(result.id, result.price);
            } else if (addToCartAfterSave) {
                showToast('Item saved, but cannot be added to cart (e.g., parent item or no price).', 'warning');
            }
            return result;
        } else {
            // apiCall should show specific error from backend if result is null or error object
            // If result is truthy but not an item object (e.g. {message: ...}), it's an unexpected success response
            console.error("Save item response was not a valid item object:", result);
            showToast(itemId ? 'Failed to update item. Unexpected server response.' : 'Failed to create item. Unexpected server response.', 'error');
            return null;
        }
    } catch (error) {
        // This catch is redundant if apiCall handles all errors and returns null.
        // However, keeping it for safety in case apiCall itself throws an unhandled exception.
        console.error('Error saving item:', error);
        showToast('Error saving item. Check console.', 'error');
        return null;
    }
}

export async function handleDeleteImage(itemId, photoId) {
    if (!itemId || !photoId) {
        showToast('Item ID or Photo ID missing for deletion.', 'error');
        return;
    }
    showToast('Attempting to delete image...', 'info', 1500);
    const result = await apiCall(`/items/${itemId}/photos/${photoId}`, 'DELETE');
    if (result && result.message) {
        showToast('Image deleted successfully.', 'success');
        // Remove the image preview from the DOM
        const photoPreviewDiv = document.getElementById(`photo-preview-${photoId}`);
        if (photoPreviewDiv) {
            photoPreviewDiv.remove();
        }
        // Optionally, refresh item data if primary status might change or for consistency
        // openEditItemForm(itemId); 
    } else if (result === true) { // DELETE might return 204 No Content, which apiCall maps to true
        showToast('Image deleted successfully.', 'success');
        const photoPreviewDiv = document.getElementById(`photo-preview-${photoId}`);
        if (photoPreviewDiv) photoPreviewDiv.remove();
    } else {
        // Error already shown by apiCall
        console.error("Failed to delete image, result:", result);
    }
}

// Helper to display names of selected files for upload
export function displaySelectedFileNames(files) {
    if (!itemImagesListDiv) return; // Should be defined if this function is called
    // This function is primarily for new uploads, existing images are handled by openEditItemForm
    // If we want to mix display, this needs adjustment.
    // For now, let's assume this clears and shows names of files *to be* uploaded.
    // itemImagesListDiv.innerHTML = ''; // Don't clear if we want to append to existing images display
    if (files.length > 0) {
        const names = Array.from(files).map(file => file.name).join(', ');
        const p = document.createElement('p');
        p.textContent = `Selected for upload: ${names}`;
        // Maybe append this to a specific part of itemImagesListDiv or a different div
        // For now, just logging, actual display might be integrated directly or this function enhanced
        console.log("Files selected for upload:", names);
        // Example: itemImagesListDiv.appendChild(p);
    } 
}

// Placeholder for variant management UI/logic if it becomes complex
export function openVariantManagementInterface(parentItem) {
    showToast(`Variant management for ${parentItem.title} (ID: ${parentItem.id}) is not fully implemented.`, 'info');
    console.log("Open variant management for:", parentItem);
    // This could open a new modal or re-purpose the item form for variants.
    // For now, the `manageVariantsButton` in `app.js` (or moved here) will call `openAddItemForm`
    // and pre-fill parent_id.
}

// Logic for the manage variants button (to be called by an event listener)
// This function now directly uses openAddItemForm from this module.
export function handleManageVariantsClick() {
    if (!manageVariantsButton || !itemSkuInput || !itemTitleInput || !itemParentIdInput || !itemModalTitle) return;

    const parentItemId = manageVariantsButton.dataset.parentItemId;
    const parentItemSku = itemSkuInput.value; 
    const parentItemTitle = itemTitleInput.value; 

    if (parentItemId) {
        closeAddEditItemModal(); 
        openAddItemForm(); 
        
        itemParentIdInput.value = parentItemId;
        itemModalTitle.textContent = `Add Variant for: ${parentItemTitle} (SKU: ${parentItemSku})`;
        itemSkuInput.value = ''; 
        itemTitleInput.value = parentItemTitle + ' - '; 
        if (itemPriceInput) itemPriceInput.focus(); 
    } else {
        showToast("Error: Parent item ID not found for managing variants. Ensure you are editing a parent item.", 'error');
    }
}

export function setupItemImageDropZone() {
    if (itemImageDropZone && itemImagesUploadInput) {
        itemImageDropZone.addEventListener('click', () => itemImagesUploadInput.click());
        itemImageDropZone.addEventListener('dragover', (event) => {
            event.preventDefault();
            itemImageDropZone.classList.add('dragover');
        });
        itemImageDropZone.addEventListener('dragleave', () => {
            itemImageDropZone.classList.remove('dragover');
        });
        itemImageDropZone.addEventListener('drop', (event) => {
            event.preventDefault();
            itemImageDropZone.classList.remove('dragover');
            if (event.dataTransfer.files.length) {
                itemImagesUploadInput.files = event.dataTransfer.files;
                displaySelectedFileNames(itemImagesUploadInput.files); // Call helper
            }
        });
    }
}

export async function handleItemClick(itemId, itemTitle, itemPrice, itemSku, parentId) {
    // This function is called from app.js for quick-add parent items.
    // It needs to construct a 'parentItem' object similar to what openVariantSelectionModal expects.
    if (parentId === -2) {
        const parentItem = {
            id: itemId,
            title: itemTitle,
            price: itemPrice, // May be null or 0 for parent items
            sku: itemSku,
            parent_id: parentId // explicitly pass -2
        };
        // Define the callback for adding to cart
        const addToCartCallback = (selectedVariant) => {
            if (selectedVariant && selectedVariant.id && selectedVariant.price !== null && selectedVariant.price !== undefined) {
                addItemToCart(selectedVariant.id, selectedVariant.price);
                showToast(`${selectedVariant.title} added to cart.`, 'success');
            } else {
                showToast('Selected variant cannot be added to cart (missing ID or price).', 'warning');
            }
        };
        // Call openVariantSelectionModal with the parentItem, the callback, and config
        // For this context (clicking a Quick Add dashboard item), we don't want to offer adding parent again, just its variants to cart.
        await openVariantSelectionModal(parentItem, addToCartCallback, { showAddParentButton: false, actionButtonText: "Add to Cart" });
    } else {
        // This is a simple item (not a parent) clicked from Quick Add dashboard
        if (itemPrice !== null && itemPrice !== undefined) {
            addItemToCart(itemId, itemPrice);
            showToast(`${itemTitle} added to cart.`, 'success');
        } else {
            showToast(`Price missing for ${itemTitle}. Cannot add to cart.`, 'error');
            console.error('handleItemClick called for non-parent item without price:', { itemId, itemTitle, itemPrice, itemSku, parentId });
        }
    }
}

// --- Exports ---
// Removed direct export of DOM element variables as they are initialized in initItemService and used internally.
// Functions are exported individually at their definition. 