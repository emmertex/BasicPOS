import { apiCall } from './apiService.js';
import { showToast } from './toastService.js';
import { state, setState } from './uiState.js'; // setState might be needed for currentQuickAddPage
import { addItemToCart } from './cart.js';
import { openVariantSelectionModal } from './itemService.js'; // If quick add items can be variant parents

// --- DOM Element Selectors ---
let quickAddGridContainer;
let quickAddCurrentPageSpan;
let quickAddPageInfoDiv;
let quickAddEditModeBtn;
let quickAddControlsDiv;
let quickAddNewItemBtn;
let quickAddNewPageLinkBtn;

// "Add New Item to Quick Add" Modal
let quickAddNewItemModal;
let closeQuickAddNewItemModalBtn;
let qaiItemSearchInput;
let qaiItemSearchButton;
let qaiItemSearchResultsDiv;
let qaiItemColorInput;
let qaiSubmitNewItemButton;

// "Add New Page Link to Quick Add" Modal
let quickAddNewPageLinkModal;
let closeQuickAddNewPageLinkModalBtn;
let qaiPageLinkLabelInput;
let qaiPageLinkTargetInput;
let qaiPageLinkColorInput;
let qaiSubmitNewPageLinkButton;

// Drag and Drop State
let draggedQAI = null;
let draggedQAIOriginalPosition = null;
let editingQaiId = null;

export function initQuickAddService() {
    // Main Dashboard Elements
    quickAddGridContainer = document.getElementById('quick-add-grid-container');
    quickAddCurrentPageSpan = document.getElementById('quick-add-current-page');
    quickAddPageInfoDiv = document.getElementById('quick-add-page-info');
    quickAddEditModeBtn = document.getElementById('quick-add-edit-mode-btn');
    quickAddControlsDiv = document.getElementById('quick-add-controls');
    quickAddNewItemBtn = document.getElementById('quick-add-new-item-btn');
    quickAddNewPageLinkBtn = document.getElementById('quick-add-new-page-link-btn');

    // "Add New Item to Quick Add" Modal Elements
    quickAddNewItemModal = document.getElementById('quick-add-new-item-modal');
    closeQuickAddNewItemModalBtn = document.getElementById('close-quick-add-new-item-modal');
    qaiItemSearchInput = document.getElementById('qai-item-search-input');
    qaiItemSearchButton = document.getElementById('qai-item-search-button');
    qaiItemSearchResultsDiv = document.getElementById('qai-item-search-results');
    qaiItemColorInput = document.getElementById('qai-item-color');

    // "Add New Page Link to Quick Add" Modal Elements
    quickAddNewPageLinkModal = document.getElementById('quick-add-new-page-link-modal');
    closeQuickAddNewPageLinkModalBtn = document.getElementById('close-quick-add-new-page-link-modal');
    qaiPageLinkLabelInput = document.getElementById('qai-page-link-label');
    qaiPageLinkTargetInput = document.getElementById('qai-page-link-target');
    qaiPageLinkColorInput = document.getElementById('qai-page-link-color');
    qaiSubmitNewPageLinkButton = document.getElementById('qai-submit-new-page-link-button');

    // Event Listeners for Main Dashboard
    if (quickAddEditModeBtn) {
        quickAddEditModeBtn.addEventListener('click', toggleQuickAddEditMode);
    }
    if (quickAddNewItemBtn) {
        quickAddNewItemBtn.addEventListener('click', () => openQuickAddNewItemModal());
    }
    if (quickAddNewPageLinkBtn) {
        quickAddNewPageLinkBtn.addEventListener('click', openQuickAddNewPageLinkModal);
    }

    // Event Listeners for "Add New Item to Quick Add" Modal
    if (closeQuickAddNewItemModalBtn) {
        closeQuickAddNewItemModalBtn.addEventListener('click', closeQuickAddNewItemModal);
    }
    if (qaiItemSearchButton) {
        qaiItemSearchButton.addEventListener('click', handleSearchQAIItems);
    }
    if (qaiItemSearchInput) {
        qaiItemSearchInput.addEventListener('keyup', (event) => {
            if (event.key === 'Enter') handleSearchQAIItems();
        });
    }
    
    // Event Listeners for "Add New Page Link to Quick Add" Modal
    if (closeQuickAddNewPageLinkModalBtn) {
        closeQuickAddNewPageLinkModalBtn.addEventListener('click', closeQuickAddNewPageLinkModal);
    }
    if (qaiSubmitNewPageLinkButton) {
        qaiSubmitNewPageLinkButton.addEventListener('click', handleSaveQuickAddPageLink);
    }

    // Initial Load (if state.currentQuickAddPage is set)
    if (state.currentQuickAddPage !== undefined) {
        loadQuickAddItems(state.currentQuickAddPage);
    } else {
        loadQuickAddItems(1); // Default to page 1
    }
    
    // Global window click for modals specific to quick add service
    window.addEventListener('click', (event) => {
        if (quickAddNewItemModal && event.target === quickAddNewItemModal) closeQuickAddNewItemModal();
        if (quickAddNewPageLinkModal && event.target === quickAddNewPageLinkModal) closeQuickAddNewPageLinkModal();
    });

    qaiSubmitNewItemButton = document.getElementById('qai-submit-new-item-button');
    qaiSubmitNewPageLinkButton = document.getElementById('qai-submit-new-page-link-button');

    if (qaiSubmitNewItemButton) {
        qaiSubmitNewItemButton.addEventListener('click', () => {
            console.log("[qaiSubmitNewItemButton CLICKED] Current editingQaiId:", editingQaiId);
            handleSaveQuickAddItem();
        });
        console.log("[initQuickAddService] Event listener ATTACHED to qaiSubmitNewItemButton.");
    } else {
        console.error("[initQuickAddService] qaiSubmitNewItemButton was NOT FOUND by getElementById.");
    }
    if (qaiSubmitNewPageLinkButton) {
        qaiSubmitNewPageLinkButton.addEventListener('click', handleSaveQuickAddPageLink);
    }
}

export function toggleQuickAddEditMode() {
    state.quickAddEditMode = !state.quickAddEditMode;
    console.log(`[toggleQuickAddEditMode] state.quickAddEditMode is now: ${state.quickAddEditMode}`);
    if (quickAddControlsDiv) quickAddControlsDiv.style.display = state.quickAddEditMode ? 'block' : 'none';
    if (quickAddGridContainer) {
        quickAddGridContainer.classList.toggle('edit-mode', state.quickAddEditMode);
        console.log(`[toggleQuickAddEditMode] quickAddGridContainer classList: ${quickAddGridContainer.className}`);
    }
    loadQuickAddItems(state.currentQuickAddPage);
    showToast(`Quick Add Edit Mode: ${state.quickAddEditMode ? 'ON' : 'OFF'}`, 'info');
}

export async function loadQuickAddItems(pageNumber) {
    if (!quickAddGridContainer || !quickAddCurrentPageSpan || !quickAddPageInfoDiv) {
        console.warn("Quick Add UI elements not fully initialized for load.");
        return;
    }
    setState('currentQuickAddPage', pageNumber);
    quickAddCurrentPageSpan.textContent = pageNumber;
    quickAddPageInfoDiv.style.display = 'block';
    quickAddGridContainer.innerHTML = '<p>Loading quick add items...</p>';

    try {
        const items = await apiCall(`/quick-add-items?page=${pageNumber}`);
        quickAddGridContainer.innerHTML = ''; // Clear loading message

        if (pageNumber > 1) {
            const homeButtonData = {
                id: 'qai-home-link', 
                type: 'page_link',
                label: 'Home (Page 1)',
                target_page_number: 1,
                color: '#EAEAEA', 
                position: -1 
            };
            quickAddGridContainer.appendChild(createQuickAddItemElement(homeButtonData));
        }

        if (items && items.length > 0) {
            items.forEach(qItem => { 
                quickAddGridContainer.appendChild(createQuickAddItemElement(qItem));
            });
        } else if (pageNumber === 1 && (!items || items.length === 0)) { 
            quickAddGridContainer.innerHTML = '<p>No items on this page. Add some in Edit Mode!</p>';
        } else if (pageNumber > 1 && (!items || items.length === 0) && quickAddGridContainer.children.length === 1 && quickAddGridContainer.children[0].dataset.qaiId === 'qai-home-link') {
            const p = document.createElement('p');
            p.textContent = "No further items on this page.";
            quickAddGridContainer.appendChild(p);
        }
    } catch (error) {
        console.error("Error loading quick add items:", error);
        quickAddGridContainer.innerHTML = '<p>Error loading items. Please try again.</p>';
        showToast("Could not load quick add items.", "error");
    }
    // Apply edit mode dependent attributes after items are rendered
    document.querySelectorAll('.quick-add-item, .quick-add-page-link').forEach(el => {
        const qaiId = el.dataset.qaiId;
        if (state.quickAddEditMode && qaiId !== 'qai-home-link') {
            el.setAttribute('draggable', 'true');
        } else {
            el.removeAttribute('draggable');
        }
    });
    // The edit-mode class on quickAddGridContainer will control delete button visibility via CSS
}

function getContrastingTextColor(hexBgColor) {
    // Convert hex to RGB
    let rgbBgColor = hexBgColor;
    if (hexBgColor.startsWith('#')) {
        const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
        hexBgColor = hexBgColor.replace(shorthandRegex, (m, r, g, b) => r + r + g + g + b + b);
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hexBgColor);
        rgbBgColor = result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : null;
    } else if (hexBgColor.startsWith('rgb')) {
        const parts = hexBgColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d\.]+)?\)/);
        if (parts) {
            rgbBgColor = { r: parseInt(parts[1]), g: parseInt(parts[2]), b: parseInt(parts[3]) };
        } else {
            rgbBgColor = null; // Could not parse
        }
    } else {
        // If it's a named color or some other format, default to dark text on unknown.
        // Or, try to parse it if it's a common name, but that's complex.
        // For simplicity, if we can't parse it as hex/rgb, we assume a default that might be overridden by CSS.
        // However, our background is usually set via a color picker, so it should be hex or rgb.
        // Fallback to a default (e.g., black text) if parsing fails completely.
        console.warn("getContrastingTextColor: Could not parse background color:", hexBgColor, "Defaulting text to black.");
        return '#000000';
    }

    if (!rgbBgColor) {
        console.warn("getContrastingTextColor: Failed to convert background color to RGB:", hexBgColor, "Defaulting text to black.");
        return '#000000'; // Default to black if parsing failed
    }

    // Calculate brightness (simple formula)
    const brightness = Math.round(((parseInt(rgbBgColor.r) * 299) +
                                 (parseInt(rgbBgColor.g) * 587) +
                                 (parseInt(rgbBgColor.b) * 114)) / 1000);
    
    // Return black for light backgrounds, white for dark backgrounds
    return (brightness > 150) ? '#000000' : '#ffffff';
}

function createQuickAddItemElement(qaiData) {
    console.log(`[createQuickAddItemElement] For item '${qaiData.label}' (ID: ${qaiData.id}), state.quickAddEditMode is: ${state.quickAddEditMode}`);
    const itemDiv = document.createElement('div');
    itemDiv.dataset.qaiId = qaiData.id;
    if (qaiData.position !== undefined) itemDiv.dataset.qaiPosition = qaiData.position;
    itemDiv.dataset.qaiType = qaiData.type;
    itemDiv.style.backgroundColor = qaiData.color || '#f0f0f0';
    
    // Determine and set contrasting text color
    // Ensure we pass the actual color string to the helper
    itemDiv.style.color = getContrastingTextColor(itemDiv.style.backgroundColor);

    let deleteButtonHTML = '';
    if (state.quickAddEditMode && qaiData.id !== 'qai-home-link') {
        deleteButtonHTML = `<button class="delete-qai-btn" title="Remove">&times;</button>`;
    }
    console.log(`[createQuickAddItemElement] For item '${qaiData.label}', deleteButtonHTML: '${deleteButtonHTML}'`);

    if (qaiData.type === 'item' || qaiData.type === 'variant_parent') {
        itemDiv.className = 'quick-add-item';
        let imageHTML = '';
        if (qaiData.primary_photo_small_url) {
            imageHTML = `<img src="${qaiData.primary_photo_small_url}" alt="" class="quick-add-item-image">`;
            itemDiv.classList.add('has-image');
        }
        itemDiv.innerHTML = `
            ${imageHTML}
            <span class="item-title">${qaiData.label}</span>
            ${deleteButtonHTML}
        `;
        itemDiv.addEventListener('click', (e) => {
            if (e.target.classList.contains('delete-qai-btn')) return;
            if (state.quickAddEditMode) {
                openQuickAddNewItemModal(qaiData);
                return;
            }
            // Non-edit mode click logic (add to cart / open variants)
            if (qaiData.item_parent_id === -2) { 
                apiCall(`/items/${qaiData.item_id}`).then(parentItemDetails => {
                    if (parentItemDetails) {
                        openVariantSelectionModal(parentItemDetails, (selectedVariant) => {
                            if (selectedVariant && selectedVariant.id && selectedVariant.price !== undefined) {
                                addItemToCart(selectedVariant.id, selectedVariant.price);
                            }
                        }, { showAddParentButton: true, actionButtonText: "Add to Cart" });
                    } else {
                        showToast("Could not fetch details for parent item.", "error");
                    }
                });
            } else if (qaiData.item_id && qaiData.item_price !== null && qaiData.item_price !== undefined) {
                addItemToCart(qaiData.item_id, qaiData.item_price);
            } else {
                showToast("Item cannot be added to cart (missing ID or price).", "warning");
            }
        });
    } else if (qaiData.type === 'page_link') {
        itemDiv.className = 'quick-add-page-link';
        itemDiv.innerHTML = `
            <span class="link-label">${qaiData.label}</span>
            ${deleteButtonHTML}
        `;
        itemDiv.addEventListener('click', (e) => {
            if (e.target.classList.contains('delete-qai-btn')) return;
            if (state.quickAddEditMode && qaiData.id !== 'qai-home-link') {
                openQuickAddNewPageLinkModal(qaiData);
                return;
            }
            if (qaiData.target_page_number) {
                loadQuickAddItems(qaiData.target_page_number);
            }
        });
    }
    
    if (qaiData.id !== 'qai-home-link') {
      // Drag and drop listeners are only for actual DB items
      itemDiv.addEventListener('dragstart', (e) => handleQAIDragStart(e, itemDiv, qaiData));
      itemDiv.addEventListener('dragend', handleQAIDragEnd);
      itemDiv.addEventListener('dragover', handleQAIDragOver);
      itemDiv.addEventListener('drop', (e) => handleQAIDrop(e, itemDiv));

      const deleteBtn = itemDiv.querySelector('.delete-qai-btn');
      if (deleteBtn) {
          deleteBtn.addEventListener('click', (e) => {
              e.stopPropagation(); 
              if (confirm(`Are you sure you want to remove "${qaiData.label}" from the Quick Add dashboard?`)) {
                  handleDeleteQuickAddItem(qaiData.id, qaiData.label);
              }
          });
      }
    }
    return itemDiv;
}

// --- "Add New Item to Quick Add" Modal Functions ---
function openQuickAddNewItemModal(existingData = null) {
    console.log('[openQuickAddNewItemModal] Called. Initial existingData:', existingData);

    if (quickAddNewItemModal) {
        // Always reset search input state before deciding add/edit specific states
        if (qaiItemSearchInput) {
            qaiItemSearchInput.value = ''; 
            qaiItemSearchInput.disabled = false; // Default to enabled
            qaiItemSearchInput.placeholder = 'Enter SKU or Title'; // Ensure placeholder is reset
        } else { 
            console.error('qaiItemSearchInput is null in openQuickAddNewItemModal');
        }
        
        if (qaiItemSearchResultsDiv) qaiItemSearchResultsDiv.innerHTML = '';
        else console.error('qaiItemSearchResultsDiv is null in openQuickAddNewItemModal');
        
        if (qaiItemSearchButton) qaiItemSearchButton.disabled = false; // Default to enabled

        if (qaiItemColorInput) qaiItemColorInput.value = '#D0E4F5'; // Default color for both modes initially

        if (existingData && existingData.id !== undefined) { // EDIT MODE
            editingQaiId = existingData.id;
            console.log("[openQuickAddNewItemModal] Mode: EDIT. ID:", editingQaiId, "Label:", existingData.label);
            if (qaiItemSearchInput) {
                qaiItemSearchInput.value = existingData.label; 
                qaiItemSearchInput.disabled = true; 
            }
            if (qaiItemSearchButton) qaiItemSearchButton.disabled = true;
            if (qaiItemColorInput && existingData.color) qaiItemColorInput.value = existingData.color; // Set specific color for edit
            if (qaiSubmitNewItemButton) qaiSubmitNewItemButton.textContent = 'Update Item Tile';
            if (qaiItemSearchResultsDiv) qaiItemSearchResultsDiv.style.display = 'none';
            if (qaiItemColorInput) qaiItemColorInput.focus(); 
        } else { // ADD NEW MODE
            editingQaiId = null;
            console.log("[openQuickAddNewItemModal] Mode: ADD NEW.");
            if (qaiItemSearchInput) {
                qaiItemSearchInput.disabled = false; // Ensure it's enabled
                qaiItemSearchInput.placeholder = 'Enter SKU or Title'; // Ensure placeholder
            } 
            if (qaiItemSearchButton) qaiItemSearchButton.disabled = false;
            if (qaiSubmitNewItemButton) qaiSubmitNewItemButton.textContent = 'Add Selected Item to Page';
            if (qaiItemSearchResultsDiv) qaiItemSearchResultsDiv.style.display = 'block'; 
            if (qaiItemSearchInput) qaiItemSearchInput.focus(); 
        }
        quickAddNewItemModal.style.display = 'block';
    }
}

function closeQuickAddNewItemModal() {
    if (quickAddNewItemModal) quickAddNewItemModal.style.display = 'none';
}

async function handleSearchQAIItems() {
    const originalQuery = qaiItemSearchInput.value.trim();
    if (!originalQuery) {
        qaiItemSearchResultsDiv.innerHTML = '<p>Please enter a search term (SKU or Title).</p>';
        return;
    }
    qaiItemSearchResultsDiv.innerHTML = '<p>Searching...</p>';
    
    let apiResults;
    try {
        // Fetch items from the API with specific filters
        // 'q' for text search, 'is_active' and 'is_current_version' as per requirements.
        apiResults = await apiCall('/items/', 'GET', null, {
            q: originalQuery,
            is_active: 'true',
            is_current_version: 'true'
        });
    } catch (error) {
        console.error("Error searching items for Quick Add:", error);
        qaiItemSearchResultsDiv.innerHTML = '<p>Error searching for items. Please try again.</p>';
        showToast("Error searching items.", "error");
        return;
    }

    // The results from the API are now considered final based on the new requirements.
    // No further client-side filtering on parent_id or active status is needed.
    const results = apiResults;

    qaiItemSearchResultsDiv.innerHTML = ''; // Clear "Searching..." or previous results
    if (results && results.length > 0) {
        results.forEach(item => {
            const div = document.createElement('div');
            // NOTE: The class name was 'qai-search-result-item' in the modal's search results in quickAddService.js
            // but the CSS for 'Create Combination Item' modal uses '.search-result-item'.
            // Assuming 'qai-search-result-item' is correct for THIS modal.
            // If not, this class name needs to match the CSS for this specific modal's search results.
            div.className = 'qai-search-result-item'; // Ensure this matches the CSS for this modal.
            
            const photosStr = item.photos ? JSON.stringify(item.photos) : '[]';
            // Store all data in the div for later retrieval by the main button
            div.dataset.itemId = item.id;
            div.dataset.itemTitle = item.title;
            div.dataset.itemPrice = item.price;
            div.dataset.itemSku = item.sku || '';
            div.dataset.itemParentId = item.parent_id;
            div.dataset.itemPhotos = photosStr;

            div.innerHTML = `
                <div class="qai-search-item-text">
                    <strong>${item.title}</strong> (SKU: ${item.sku || 'N/A'}) - Price: $${item.price ? parseFloat(item.price).toFixed(2) : 'N/A'}
                </div>
                <button class="btn btn-sm btn-success qai-search-result-add-btn">Add</button> 
            `; 
            // Add listener to the main div to select it
            div.addEventListener('click', (e) => {
                // If the click is on the button itself, let button handler do its work.
                if (e.target.classList.contains('qai-search-result-add-btn')) return;

                document.querySelectorAll('#qai-item-search-results .qai-search-result-item').forEach(el => el.classList.remove('selected'));
                div.classList.add('selected');
                console.log("Selected item from search results:", item.title);
            });
            // Add listener to the specific Add button in search results
            div.querySelector('.qai-search-result-add-btn').addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent div click handler from firing
                // Mark this item as selected, then the user clicks the main "Add Selected Item" button
                document.querySelectorAll('#qai-item-search-results .qai-search-result-item').forEach(el => el.classList.remove('selected'));
                div.classList.add('selected');
                showToast(`${item.title} selected. Click 'Add Selected Item to Page'.`, 'info', 2000);
            });
            qaiItemSearchResultsDiv.appendChild(div);
        });
    } else {
        qaiItemSearchResultsDiv.innerHTML = '<p>No items found matching your search.</p>';
    }
}

async function handleSaveQuickAddItem() { 
    const currentQaiId = editingQaiId; 
    console.log(`[handleSaveQuickAddItem] START. Editing ID: ${currentQaiId}`);

    let dataToSave;
    let endpoint;
    let method;

    if (currentQaiId) { 
        console.log('[handleSaveQuickAddItem] Mode: EDITING');
        const newLabel = qaiItemSearchInput.value.trim();
        const newColor = qaiItemColorInput ? qaiItemColorInput.value : '#D0E4F5';
        
        if (!newLabel) {
            showToast("Label cannot be empty when updating.", "warning");
            console.log('[handleSaveQuickAddItem] EDITING validation failed: Label empty.');
            return;
        }
        dataToSave = {
            label: newLabel, 
            color: newColor
        };
        endpoint = `/quick-add-items/${currentQaiId}`;
        method = 'PUT';
        console.log(`[handleSaveQuickAddItem] EDITING - Payload for PUT ${endpoint}:`, dataToSave);
    } else { 
        console.log('[handleSaveQuickAddItem] Mode: ADDING');
        const selectedItemDiv = qaiItemSearchResultsDiv.querySelector('.qai-search-result-item.selected');
        
        if (!selectedItemDiv) {
            showToast("Please select an item from the search results first by clicking on it.", "warning");
            console.log('[handleSaveQuickAddItem] ADDING failed: No .selected item found in search results.');
            return;
        }

        const itemId = selectedItemDiv.dataset.itemId; 
        const itemTitle = selectedItemDiv.dataset.itemTitle;
        const itemPrice = selectedItemDiv.dataset.itemPrice;
        const itemSku = selectedItemDiv.dataset.itemSku;
        const itemParentId = selectedItemDiv.dataset.itemParentId;
        const photosStr = selectedItemDiv.dataset.itemPhotos; // Keep as string for now

        if (!itemId || !itemTitle) {
            showToast("Selected item data is incomplete.", "error");
            console.log('[handleSaveQuickAddItem] ADDING failed: Incomplete data from .selected item.');
            return;
        }
        let primaryPhotoUrl = null;
        try {
            const photosData = JSON.parse(photosStr || '[]');
            if (photosData && photosData.length > 0) {
                const primary = photosData.find(p => p.is_primary);
                primaryPhotoUrl = (primary && primary.small_url) || (photosData[0] && photosData[0].small_url) || null;
            }
        } catch (e) {
            console.error("Error parsing photosData for QAI:", e);
        }

        dataToSave = {
            page_number: state.currentQuickAddPage,
            type: parseInt(itemParentId) === -2 ? 'variant_parent' : 'item',
            label: itemTitle,
            item_id: parseInt(itemId),
            item_sku: itemSku,
            item_price: parseFloat(itemPrice),
            item_parent_id: parseInt(itemParentId),
            primary_photo_small_url: primaryPhotoUrl,
            color: qaiItemColorInput ? qaiItemColorInput.value : '#D0E4F5'
        };
        endpoint = '/quick-add-items';
        method = 'POST';
        console.log(`[handleSaveQuickAddItem] ADDING - Payload for POST ${endpoint}:`, dataToSave);
    }

    if (!dataToSave) { 
        showToast("Error preparing data for save.", "error");
        console.log('[handleSaveQuickAddItem] CRITICAL: dataToSave is undefined before API call.');
        return;
    }

    console.log(`[handleSaveQuickAddItem] Making API call: ${method} ${endpoint}`);
    try {
        const result = await apiCall(endpoint, method, dataToSave);
        console.log('[handleSaveQuickAddItem] API call result:', result);

        if (result && (result.id || result.success || method === 'PUT')) { 
            showToast(`Quick Add item ${currentQaiId ? 'updated' : 'added'} successfully.`, 'success');
            loadQuickAddItems(state.currentQuickAddPage);
            closeQuickAddNewItemModal();
        } else {
            showToast(result?.error || `Failed to ${currentQaiId ? 'update' : 'add'} Quick Add item.`, 'error');
        }
    } catch (error) {
        console.error(`Error ${currentQaiId ? 'updating' : 'adding'} Quick Add item:`, error);
        showToast(`Error ${currentQaiId ? 'updating' : 'adding'} Quick Add item: ` + (error.message || ""), 'error');
    }
    editingQaiId = null; 
    console.log('[handleSaveQuickAddItem] END. editingQaiId reset.');
}

// --- "Add New Page Link to Quick Add" Modal Functions ---
function openQuickAddNewPageLinkModal(existingData = null) {
    if (quickAddNewPageLinkModal) {
        if (existingData) {
            editingQaiId = existingData.id;
            qaiPageLinkLabelInput.value = existingData.label || '';
            qaiPageLinkTargetInput.value = existingData.target_page_number || '';
            qaiPageLinkColorInput.value = existingData.color || '#E8D0F5';
            if (qaiSubmitNewPageLinkButton) qaiSubmitNewPageLinkButton.textContent = 'Update Page Link';
        } else {
            editingQaiId = null;
            qaiPageLinkLabelInput.value = '';
            qaiPageLinkTargetInput.value = '';
            qaiPageLinkColorInput.value = '#E8D0F5';
            if (qaiSubmitNewPageLinkButton) qaiSubmitNewPageLinkButton.textContent = 'Add Page Link';
        }
        quickAddNewPageLinkModal.style.display = 'block';
    }
}

function closeQuickAddNewPageLinkModal() {
    if (quickAddNewPageLinkModal) quickAddNewPageLinkModal.style.display = 'none';
}

async function handleSaveQuickAddPageLink() {
    const label = qaiPageLinkLabelInput.value.trim();
    const targetPage = parseInt(qaiPageLinkTargetInput.value, 10);
    const color = qaiPageLinkColorInput.value;

    if (!label || isNaN(targetPage) || targetPage <= 0) {
        showToast("Label and a valid positive target page number are required.", "warning");
        return;
    }
    if (!editingQaiId && targetPage === state.currentQuickAddPage) {
        showToast("Cannot link to the current page.", "warning");
        return;
    }

    const qaiData = {
        label: label,
        target_page_number: targetPage,
        color: color
    };
    if (!editingQaiId) {
        qaiData.page_number = state.currentQuickAddPage;
        qaiData.type = 'page_link';
    }

    try {
        const endpoint = editingQaiId ? `/quick-add-items/${editingQaiId}` : '/quick-add-items';
        const method = editingQaiId ? 'PUT' : 'POST';
        const result = await apiCall(endpoint, method, qaiData);

        if (result && (result.id || result.success)) {
            showToast(`Page link ${editingQaiId ? 'updated' : 'added'} successfully.`, 'success');
            loadQuickAddItems(state.currentQuickAddPage);
            closeQuickAddNewPageLinkModal();
        } else {
            showToast(result?.error || "Failed to save page link.", 'error');
        }
    } catch (error) {
        console.error("Error saving page link:", error);
        showToast("Error saving page link: " + (error.message || ""), 'error');
    }
    editingQaiId = null;
}

// --- Delete Quick Add Item ---
async function handleDeleteQuickAddItem(qaiId, qaiLabel) {
    try {
        const response = await apiCall(`/quick-add-items/${qaiId}`, 'DELETE');
        // Assuming DELETE returns { success: true } or similar, or just a 200/204 status
        if (response && (response.success || response.message)) { // Adjust based on actual API response
            showToast(`"${qaiLabel}" removed from Quick Add.`, 'success');
            loadQuickAddItems(state.currentQuickAddPage); // Refresh
        } else {
             // Check if response itself is the error message from a non-2xx status
            const errorMsg = typeof response === 'string' ? response : (response?.error || "Failed to remove item.");
            showToast(errorMsg, 'error');
        }
    } catch (error) {
        console.error(`Error deleting quick add item ${qaiId}:`, error);
        showToast(`Error removing item: ${error.message || 'Unknown server error.'}`, 'error');
    }
}

// --- Drag and Drop ---
function handleQAIDragStart(e, itemDiv, qaiData) {
    if (!state.quickAddEditMode) {
        e.preventDefault();
        return;
    }
    draggedQAI = itemDiv;
    draggedQAIOriginalPosition = qaiData.position; // Store original position for potential revert or logging
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', qaiData.id); // Pass QAI ID
    itemDiv.classList.add('dragging');
}

function handleQAIDragEnd(e) {
    if (draggedQAI) {
        draggedQAI.classList.remove('dragging');
    }
    draggedQAI = null;
    draggedQAIOriginalPosition = null;
    // Clean up any visual cues if needed
}

function handleQAIDragOver(e) {
    if (!state.quickAddEditMode || !draggedQAI) return;
    e.preventDefault(); // Necessary to allow dropping
    e.dataTransfer.dropEffect = 'move';
    
    const targetElement = e.target.closest('.quick-add-item, .quick-add-page-link');
    if (targetElement && targetElement !== draggedQAI) {
        // Optional: visual feedback for drop target
        // targetElement.classList.add('drag-over');
    }
}

async function handleQAIDrop(e, targetElement) {
    if (!state.quickAddEditMode || !draggedQAI) return;
    e.preventDefault();
    
    const draggedQAIIdText = e.dataTransfer.getData('text/plain');
    // Do not try to parse if it's the special home link ID
    const draggedQAIId = draggedQAIIdText === 'qai-home-link' ? draggedQAIIdText : parseInt(draggedQAIIdText, 10);
    
    const targetQAIIdText = targetElement.dataset.qaiId;
    const targetQAIId = targetQAIIdText === 'qai-home-link' ? targetQAIIdText : parseInt(targetQAIIdText, 10);

    // Prevent dropping actual items onto the home link or dragging the home link
    if (draggedQAIId === 'qai-home-link' || targetQAIId === 'qai-home-link') {
        showToast("The Home link cannot be reordered or have items dropped onto it.", "warning");
        // Optionally, revert the optimistic UI update if it happened
        loadQuickAddItems(state.currentQuickAddPage); // Simple revert
        return;
    }

    if (draggedQAIId === targetQAIId) return; 

    const qaiElements = Array.from(quickAddGridContainer.children);
    const draggedElement = qaiElements.find(el => el.dataset.qaiId === String(draggedQAIId)); // Find by string ID before parsing
    const targetIdx = qaiElements.findIndex(el => el.dataset.qaiId === String(targetQAIId));

    if (!draggedElement || targetIdx === -1) {
        console.error("Could not find dragged or target element in QAI list for reorder.");
        loadQuickAddItems(state.currentQuickAddPage); // Revert UI
        return;
    }
    
    // Optimistically update UI
    // Remove dragged element first, then insert at new position
    quickAddGridContainer.removeChild(draggedElement);
    // Insert before the target's *new* position after removal
    // This needs to be more careful if dragged from before target vs after target
    const currentChildren = Array.from(quickAddGridContainer.children);
    if (targetIdx >= currentChildren.length) { // if target was last, or dragged was before target making targetIdx too high
        quickAddGridContainer.appendChild(draggedElement);
    } else {
        quickAddGridContainer.insertBefore(draggedElement, currentChildren[targetIdx]);
    }

    // Prepare payload for backend: array of {id, new_position}
    // Filter out the 'qai-home-link' before sending to backend
    const updatedPositions = Array.from(quickAddGridContainer.children)
        .filter(el => el.dataset.qaiId !== 'qai-home-link') // Exclude home link
        .map((el, index) => ({
            id: parseInt(el.dataset.qaiId, 10),
            position: index // Backend service might 0-index or 1-index, adjust if needed. Assuming 0-indexed from service context.
                         // The service QuickAddItemService.reorder_quick_add_items re-assigns based on list order.
                         // So, just sending ordered IDs is what the service needs. Position here is for client-side map, not strictly needed in payload IF service re-indexes.
                         // Let's match payload to what backend direct route now expects: {id, position} where position is new 0-based index of actual items.
        }));
    
    // The backend direct route expects an array of {id, position} where position is the new 0-indexed position within the *actual items*
    // And the service reorder_quick_add_items actually just wants ordered_ids.
    // Let's simplify the payload to what the service `reorder_quick_add_items(page_number, ordered_ids)` needs.
    const finalOrderedIds = updatedPositions.map(p => p.id);

    try {
        // The direct route direct_put_quick_add_items_reorder expects { page_number, positions: [{id, position}, ...] }
        // The service reorder_quick_add_items expects (page_number, ordered_ids_list)
        // The direct route now extracts ordered_ids from positions. So, current payload structure is fine for direct route.
        // We need to ensure the `positions` sent to the direct route are 0-indexed for the *actual items*.
        const payloadForBackend = {
            page_number: state.currentQuickAddPage,
            positions: updatedPositions.map((item, index) => ({ id: item.id, position: index })) // Ensure 0-indexed position of actual items
        };

        const result = await apiCall('/quick-add-items/reorder', 'PUT', payloadForBackend);
        if (result && (result.success || Array.isArray(result))) { 
            showToast("Quick Add layout updated.", "success");
            loadQuickAddItems(state.currentQuickAddPage); 
        } else {
            showToast(result?.error || "Failed to update layout on server.", "error");
            loadQuickAddItems(state.currentQuickAddPage); 
        }
    } catch (error) {
        console.error("Error updating QAI positions:", error);
        showToast("Error saving new layout.", "error");
        loadQuickAddItems(state.currentQuickAddPage); 
    }
}

// For now, initQuickAddService is the main entry point.
// loadQuickAddItems can be exported if app.js needs to trigger it directly.
// export { loadQuickAddItems }; 