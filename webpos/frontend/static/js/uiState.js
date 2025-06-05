export const state = {
    currentSale: null, // Will hold sale ID and items
    currentCustomer: null,
    itemsCache: [], // Cache for item details
    quickAddItemsCache: [], // Cache for currently loaded quick add items
    isQuickAddEditMode: false,
    draggedQAI: null, // To store the element being dragged
    currentQuickAddPage: 1
}; 

export function setState(key, value) {
    if (Object.prototype.hasOwnProperty.call(state, key)) {
        state[key] = value;
    } else {
        console.warn(`uiState: Attempted to set unknown state property '${key}'. If this is a new property, add it to the initial state object.`);
    }
} 