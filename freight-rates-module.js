// ============================================
// FREIGHT RATES MODULE - Supabase Integration
// ============================================
// This module handles all freight rate operations:
// - Save rates to Supabase
// - Load rates from Supabase
// - Delete rates
// - Tab switching with data refresh
// ============================================

// ============================================
// CONFIGURATION
// ============================================
const SUPABASE_URL = 'YOUR_SUPABASE_URL'; // Replace with your Supabase URL
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY'; // Replace with your anon key

// Initialize Supabase client (assumes supabase-js is loaded)
// const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ============================================
// DATA ACCESS LAYER (Supabase Operations)
// ============================================

/**
 * Save a freight rate to Supabase
 * @param {Object} rateData - The rate data to save
 * @returns {Promise<Object>} - The saved rate or error
 */
async function saveRateToSupabase(rateData) {
    try {
        // Get current user
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user) {
            throw new Error('User not authenticated');
        }

        // Add user_id to rate data
        const dataToInsert = {
            ...rateData,
            user_id: user.id
        };

        // Insert into Supabase
        const { data, error } = await supabase
            .from('freight_rates')
            .insert([dataToInsert])
            .select()
            .single();

        if (error) {
            console.error('Supabase insert error:', error);
            throw error;
        }

        console.log('Rate saved successfully:', data);
        return { success: true, data };

    } catch (error) {
        console.error('saveRateToSupabase error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Load freight rates from Supabase
 * @param {string} rateType - Filter by rate type (sea, pre_carriage, etc.) or 'all'
 * @returns {Promise<Array>} - Array of rates
 */
async function loadRatesFromSupabase(rateType = 'all') {
    try {
        // Get current user
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user) {
            throw new Error('User not authenticated');
        }

        // Build query
        let query = supabase
            .from('freight_rates')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

        // Apply rate type filter if not 'all'
        if (rateType !== 'all') {
            query = query.eq('rate_type', rateType);
        }

        const { data, error } = await query;

        if (error) {
            console.error('Supabase select error:', error);
            throw error;
        }

        console.log(`Loaded ${data.length} rates (type: ${rateType})`);
        return { success: true, data: data || [] };

    } catch (error) {
        console.error('loadRatesFromSupabase error:', error);
        return { success: false, data: [], error: error.message };
    }
}

/**
 * Delete a freight rate from Supabase
 * @param {string} rateId - UUID of the rate to delete
 * @returns {Promise<Object>} - Success/error status
 */
async function deleteRateFromSupabase(rateId) {
    try {
        const { error } = await supabase
            .from('freight_rates')
            .delete()
            .eq('id', rateId);

        if (error) {
            console.error('Supabase delete error:', error);
            throw error;
        }

        console.log('Rate deleted:', rateId);
        return { success: true };

    } catch (error) {
        console.error('deleteRateFromSupabase error:', error);
        return { success: false, error: error.message };
    }
}

// ============================================
// UI LOGIC - Form Handlers
// ============================================

/**
 * Save Sea Freight Rate
 * Collects form data and saves to Supabase
 */
async function saveSeaFreightRate(event) {
    if (event) event.preventDefault();
    
    console.log('Saving Sea Freight Rate...');
    
    try {
        // Collect form data
        const originPortSelect = document.getElementById('sfOriginPort');
        const destPortSelect = document.getElementById('sfDestPort');
        const containerSelect = document.getElementById('sfContainerType');
        const incotermSelect = document.getElementById('sfIncoterm');
        
        // Validation
        if (!originPortSelect?.value) {
            showNotification('Please select origin port', 'error');
            return false;
        }
        if (!destPortSelect?.value) {
            showNotification('Please select destination port', 'error');
            return false;
        }
        
        // Build rate object
        const rateData = {
            rate_type: 'sea',
            origin_port: originPortSelect.value,
            origin_port_name: originPortSelect.options[originPortSelect.selectedIndex]?.text || '',
            destination_port: destPortSelect.value,
            destination_port_name: destPortSelect.options[destPortSelect.selectedIndex]?.text || '',
            shipment_type: document.getElementById('sfShipmentType')?.value || 'fcl',
            container_type: containerSelect?.value || '40HC',
            incoterm: incotermSelect?.value || 'FOB',
            price: parseFloat(document.getElementById('sfBaseRate')?.value) || 0,
            currency: 'USD',
            transit_days: parseInt(document.getElementById('sfTransit')?.value) || 0,
            valid_until: document.getElementById('sfValidUntil')?.value || null,
            notes: document.getElementById('sfNotes')?.value || ''
        };
        
        // Collect included services
        const includedServices = [];
        if (document.getElementById('tagOriginHaulage')?.checked) includedServices.push('origin-haulage');
        if (document.getElementById('tagDestHaulage')?.checked) includedServices.push('dest-haulage');
        if (document.getElementById('tagTHC')?.checked) includedServices.push('thc');
        if (document.getElementById('tagCustoms')?.checked) includedServices.push('customs');
        if (document.getElementById('tagDocumentation')?.checked) includedServices.push('documentation');
        rateData.included_services = includedServices;
        
        // Save to Supabase
        const result = await saveRateToSupabase(rateData);
        
        if (result.success) {
            showNotification(`Sea Freight rate saved! ${rateData.origin_port_name} → ${rateData.destination_port_name}`, 'success');
            
            // Reset form
            document.getElementById('seaFreightForm')?.reset();
            setDefaultDates();
            populatePortDropdowns();
            
            // Refresh saved rates list
            await renderSavedRatesList();
            
        } else {
            showNotification('Error saving rate: ' + result.error, 'error');
        }
        
    } catch (error) {
        console.error('saveSeaFreightRate error:', error);
        showNotification('Error: ' + error.message, 'error');
    }
    
    return false;
}

/**
 * Save Pre-Carriage Rate
 */
async function savePreCarriageRate(event) {
    if (event) event.preventDefault();
    
    console.log('Saving Pre-Carriage Rate...');
    
    try {
        const originCitySelect = document.getElementById('pcOriginCity');
        const destPortSelect = document.getElementById('pcDestPort');
        
        if (!originCitySelect?.value) {
            showNotification('Please select origin city', 'error');
            return false;
        }
        
        const rateData = {
            rate_type: 'pre_carriage',
            origin_city: originCitySelect.value,
            destination_port: destPortSelect?.value || '',
            destination_port_name: destPortSelect?.options[destPortSelect.selectedIndex]?.text || '',
            container_type: document.getElementById('pcContainerType')?.value || '',
            price: parseFloat(document.getElementById('pcRate')?.value) || 0,
            currency: 'USD',
            transit_days: parseInt(document.getElementById('pcTransit')?.value) || 1,
            valid_until: document.getElementById('pcValidUntil')?.value || null
        };
        
        const result = await saveRateToSupabase(rateData);
        
        if (result.success) {
            showNotification(`Pre-Carriage rate saved! ${rateData.origin_city} → ${rateData.destination_port_name}`, 'success');
            document.getElementById('preCarriageForm')?.reset();
            setDefaultDates();
            await renderSavedRatesList();
        } else {
            showNotification('Error saving rate: ' + result.error, 'error');
        }
        
    } catch (error) {
        console.error('savePreCarriageRate error:', error);
        showNotification('Error: ' + error.message, 'error');
    }
    
    return false;
}

/**
 * Save On-Carriage Rate
 */
async function saveOnCarriageRate(event) {
    if (event) event.preventDefault();
    
    console.log('Saving On-Carriage Rate...');
    
    try {
        const countrySelect = document.getElementById('ocCountry');
        const originPortSelect = document.getElementById('ocOriginPort');
        
        const rateData = {
            rate_type: 'on_carriage',
            country_code: countrySelect?.value || '',
            country_name: countrySelect?.options[countrySelect.selectedIndex]?.text || '',
            origin_port: originPortSelect?.value || '',
            origin_port_name: originPortSelect?.options[originPortSelect.selectedIndex]?.text || '',
            destination_city: document.getElementById('ocDestCity')?.value || '',
            container_type: document.getElementById('ocContainerType')?.value || '',
            price: parseFloat(document.getElementById('ocRate')?.value) || 0,
            currency: document.getElementById('ocCurrency')?.value || 'USD',
            transit_days: parseInt(document.getElementById('ocTransit')?.value) || 1,
            valid_until: document.getElementById('ocValidUntil')?.value || null
        };
        
        const result = await saveRateToSupabase(rateData);
        
        if (result.success) {
            showNotification(`On-Carriage rate saved! ${rateData.origin_port_name} → ${rateData.destination_city}`, 'success');
            document.getElementById('onCarriageForm')?.reset();
            setDefaultDates();
            await renderSavedRatesList();
        } else {
            showNotification('Error saving rate: ' + result.error, 'error');
        }
        
    } catch (error) {
        console.error('saveOnCarriageRate error:', error);
        showNotification('Error: ' + error.message, 'error');
    }
    
    return false;
}

/**
 * Save Terminal/THC Rate
 */
async function saveTerminalRate(event) {
    if (event) event.preventDefault();
    
    console.log('Saving Terminal Rate...');
    
    try {
        const portSelect = document.getElementById('thcPort');
        
        const rateData = {
            rate_type: 'terminal',
            origin_port: portSelect?.value || '',
            origin_port_name: portSelect?.options[portSelect.selectedIndex]?.text || '',
            container_type: document.getElementById('thcContainerType')?.value || '',
            price: parseFloat(document.getElementById('thcRate')?.value) || 0,
            currency: 'USD',
            valid_until: document.getElementById('thcValidUntil')?.value || null,
            notes: document.getElementById('thcType')?.value || 'origin' // THC type as note
        };
        
        const result = await saveRateToSupabase(rateData);
        
        if (result.success) {
            showNotification(`Terminal rate saved! ${rateData.origin_port_name}`, 'success');
            document.getElementById('terminalForm')?.reset();
            setDefaultDates();
            await renderSavedRatesList();
        } else {
            showNotification('Error saving rate: ' + result.error, 'error');
        }
        
    } catch (error) {
        console.error('saveTerminalRate error:', error);
        showNotification('Error: ' + error.message, 'error');
    }
    
    return false;
}

/**
 * Save Foreign Customs Rate
 */
async function saveForeignCustomsRate(event) {
    if (event) event.preventDefault();
    
    console.log('Saving Foreign Customs Rate...');
    
    try {
        const countrySelect = document.getElementById('fcCountry');
        const portSelect = document.getElementById('fcPort');
        
        const rateData = {
            rate_type: 'customs',
            country_code: countrySelect?.value || '',
            country_name: countrySelect?.options[countrySelect.selectedIndex]?.text || '',
            origin_port: portSelect?.value || '',
            origin_port_name: portSelect?.options[portSelect.selectedIndex]?.text || '',
            container_type: document.getElementById('fcContainerType')?.value || '',
            price: parseFloat(document.getElementById('fcClearanceFee')?.value) || 0,
            currency: document.getElementById('fcCurrency')?.value || 'EUR',
            valid_until: document.getElementById('fcValidUntil')?.value || null,
            notes: document.getElementById('fcPartnerName')?.value || '' // Partner name in notes
        };
        
        const result = await saveRateToSupabase(rateData);
        
        if (result.success) {
            showNotification(`Customs rate saved! ${rateData.country_name}`, 'success');
            document.getElementById('foreignCustomsForm')?.reset();
            setDefaultDates();
            await renderSavedRatesList();
        } else {
            showNotification('Error saving rate: ' + result.error, 'error');
        }
        
    } catch (error) {
        console.error('saveForeignCustomsRate error:', error);
        showNotification('Error: ' + error.message, 'error');
    }
    
    return false;
}

// ============================================
// UI LOGIC - Saved Rates Display
// ============================================

// Current filter state
let currentRateFilter = 'all';

/**
 * Render the saved rates list
 * @param {string} filterType - Filter by rate type or 'all'
 */
async function renderSavedRatesList(filterType = 'all') {
    console.log('Rendering saved rates list, filter:', filterType);
    currentRateFilter = filterType;
    
    const container = document.getElementById('myRatesList');
    if (!container) {
        console.warn('myRatesList container not found');
        return;
    }
    
    // Show loading state
    container.innerHTML = '<div class="loading-rates">Loading rates...</div>';
    
    // Fetch rates from Supabase
    const result = await loadRatesFromSupabase(filterType);
    
    if (!result.success) {
        container.innerHTML = `<div class="error-rates">Error loading rates: ${result.error}</div>`;
        return;
    }
    
    const rates = result.data;
    
    // Update counts
    updateRateCounts(rates);
    
    // Check if empty
    if (rates.length === 0) {
        container.innerHTML = `
            <div class="empty-rates">
                <span class="empty-icon">📋</span>
                <p>No saved rates yet</p>
                <small>Start by adding rates from the tabs above</small>
            </div>
        `;
        return;
    }
    
    // Render rates table
    let html = '<div class="rates-table">';
    
    rates.forEach(rate => {
        const typeIcon = getTypeIcon(rate.rate_type);
        const typeLabel = getTypeLabel(rate.rate_type);
        const routeText = getRouteText(rate);
        const priceText = formatPrice(rate.price, rate.currency);
        
        html += `
            <div class="rate-row" data-id="${rate.id}" data-type="${rate.rate_type}">
                <div class="rate-type-badge ${rate.rate_type}">${typeIcon} ${typeLabel}</div>
                <div class="rate-route">${routeText}</div>
                <div class="rate-container">${rate.container_type || '-'}</div>
                <div class="rate-incoterm">${rate.incoterm || '-'}</div>
                <div class="rate-price">${priceText}</div>
                <div class="rate-actions">
                    <button class="btn-delete-rate" onclick="deleteRate('${rate.id}')" title="Delete">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                        </svg>
                    </button>
                </div>
            </div>
        `;
    });
    
    html += '</div>';
    container.innerHTML = html;
}

/**
 * Delete a rate
 * @param {string} rateId - UUID of the rate to delete
 */
async function deleteRate(rateId) {
    if (!confirm('Are you sure you want to delete this rate?')) {
        return;
    }
    
    console.log('Deleting rate:', rateId);
    
    const result = await deleteRateFromSupabase(rateId);
    
    if (result.success) {
        showNotification('Rate deleted', 'success');
        // Refresh the list
        await renderSavedRatesList(currentRateFilter);
    } else {
        showNotification('Error deleting rate: ' + result.error, 'error');
    }
}

/**
 * Filter saved rates by type
 * @param {string} filterType - Rate type to filter by
 */
async function filterSavedRates(filterType) {
    console.log('Filtering rates by:', filterType);
    
    // Update filter buttons
    document.querySelectorAll('.my-rates-filters .filter-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.textContent.toLowerCase().includes(filterType) || 
            (filterType === 'all' && btn.textContent.toLowerCase().includes('all'))) {
            btn.classList.add('active');
        }
    });
    
    // Refresh list with filter
    await renderSavedRatesList(filterType);
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function getTypeIcon(rateType) {
    const icons = {
        'sea': '🚢',
        'pre_carriage': '🚛',
        'on_carriage': '🚚',
        'terminal': '🏗️',
        'customs': '📋'
    };
    return icons[rateType] || '📦';
}

function getTypeLabel(rateType) {
    const labels = {
        'sea': 'SEA',
        'pre_carriage': 'PRE',
        'on_carriage': 'ON',
        'terminal': 'THC',
        'customs': 'CUST'
    };
    return labels[rateType] || rateType.toUpperCase();
}

function getRouteText(rate) {
    switch (rate.rate_type) {
        case 'sea':
            return `${rate.origin_port_name || rate.origin_port} → ${rate.destination_port_name || rate.destination_port}`;
        case 'pre_carriage':
            return `${rate.origin_city} → ${rate.destination_port_name || rate.destination_port}`;
        case 'on_carriage':
            return `${rate.origin_port_name || rate.origin_port} → ${rate.destination_city}`;
        case 'terminal':
            return rate.origin_port_name || rate.origin_port || 'Terminal';
        case 'customs':
            return `${rate.country_name || rate.country_code} - ${rate.origin_port_name || ''}`;
        default:
            return rate.origin_port_name || 'Unknown';
    }
}

function formatPrice(price, currency = 'USD') {
    const symbols = { 'USD': '$', 'EUR': '€', 'GBP': '£', 'TRY': '₺' };
    const symbol = symbols[currency] || currency + ' ';
    return symbol + (price || 0).toLocaleString();
}

function updateRateCounts(allRates) {
    // Count by type
    const counts = {
        sea: 0,
        pre_carriage: 0,
        on_carriage: 0,
        terminal: 0,
        customs: 0
    };
    
    allRates.forEach(rate => {
        if (counts.hasOwnProperty(rate.rate_type)) {
            counts[rate.rate_type]++;
        }
    });
    
    // Update UI elements
    const seaCount = document.getElementById('seaRatesCount');
    const preCount = document.getElementById('preRatesCount');
    const onCount = document.getElementById('onRatesCount');
    const thcCount = document.getElementById('thcRatesCount');
    const fcCount = document.getElementById('fcRatesCount');
    
    if (seaCount) seaCount.textContent = counts.sea;
    if (preCount) preCount.textContent = counts.pre_carriage;
    if (onCount) onCount.textContent = counts.on_carriage;
    if (thcCount) thcCount.textContent = counts.terminal;
    if (fcCount) fcCount.textContent = counts.customs;
}

/**
 * Show notification message
 * @param {string} message - Message to display
 * @param {string} type - 'success' or 'error'
 */
function showNotification(message, type = 'success') {
    console.log(`[${type.toUpperCase()}] ${message}`);
    
    // Try to use existing notification function
    if (typeof showRateNotification === 'function') {
        showRateNotification(message, type);
        return;
    }
    
    // Fallback: Create toast notification
    const toast = document.createElement('div');
    toast.className = `toast-notification ${type}`;
    toast.innerHTML = `
        <span class="toast-icon">${type === 'success' ? '✅' : '❌'}</span>
        <span class="toast-message">${message}</span>
    `;
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 16px 24px;
        background: ${type === 'success' ? '#10b981' : '#ef4444'};
        color: white;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 10000;
        display: flex;
        align-items: center;
        gap: 8px;
        font-weight: 500;
        animation: slideIn 0.3s ease;
    `;
    
    document.body.appendChild(toast);
    
    // Auto-remove after 4 seconds
    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// ============================================
// TAB SWITCHING
// ============================================

/**
 * Switch between rate tabs
 * @param {string} tabName - Tab to switch to
 */
function switchRateTab(tabName) {
    console.log('switchRateTab:', tabName);
    
    // Get parent section
    const ratesSection = document.getElementById('forwarderRatesSection');
    if (ratesSection) {
        ratesSection.style.cssText = 'display: block !important';
    }
    
    // Tab IDs
    const tabIds = ['seaFreight', 'preCarriage', 'onCarriage', 'terminal', 'foreignCustoms', 'myRates'];
    
    // Hide all tabs
    tabIds.forEach(id => {
        const tab = document.getElementById(id + 'Tab');
        if (tab) tab.style.cssText = 'display: none !important';
        
        const btn = document.getElementById('btn' + id.charAt(0).toUpperCase() + id.slice(1));
        if (btn) btn.classList.remove('active');
    });
    
    // Show selected tab
    const selectedTab = document.getElementById(tabName + 'Tab');
    if (selectedTab) {
        selectedTab.style.cssText = 'display: block !important';
    }
    
    // Activate button
    const selectedBtn = document.getElementById('btn' + tabName.charAt(0).toUpperCase() + tabName.slice(1));
    if (selectedBtn) {
        selectedBtn.classList.add('active');
    }
    
    // Tab-specific initialization
    switch (tabName) {
        case 'seaFreight':
            if (typeof populatePortDropdowns === 'function') populatePortDropdowns();
            if (typeof setDefaultDates === 'function') setDefaultDates();
            break;
        case 'preCarriage':
            if (typeof populateTurkishCities === 'function') populateTurkishCities();
            if (typeof populatePortDropdowns === 'function') populatePortDropdowns();
            if (typeof setDefaultDates === 'function') setDefaultDates();
            break;
        case 'onCarriage':
            if (typeof populateCountryDropdown === 'function') populateCountryDropdown();
            if (typeof setDefaultDates === 'function') setDefaultDates();
            break;
        case 'terminal':
        case 'foreignCustoms':
            if (typeof populatePortDropdowns === 'function') populatePortDropdowns();
            if (typeof setDefaultDates === 'function') setDefaultDates();
            break;
        case 'myRates':
            renderSavedRatesList(currentRateFilter);
            break;
    }
}

// ============================================
// INITIALIZATION
// ============================================

/**
 * Initialize freight rates module
 * Call this when the rates section is first shown
 */
async function initFreightRatesModule() {
    console.log('Initializing Freight Rates Module...');
    
    // Check if Supabase is available
    if (typeof supabase === 'undefined') {
        console.error('Supabase client not found!');
        return;
    }
    
    // Check authentication
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        console.warn('User not authenticated');
        return;
    }
    
    console.log('User authenticated:', user.email);
    
    // Initialize dropdowns
    if (typeof populatePortDropdowns === 'function') populatePortDropdowns();
    if (typeof setDefaultDates === 'function') setDefaultDates();
    
    // Load initial saved rates
    await renderSavedRatesList();
    
    console.log('Freight Rates Module initialized');
}

// ============================================
// CSS for Rate List (inject into page)
// ============================================
const rateListStyles = `
<style>
.rates-table {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.rate-row {
    display: flex;
    align-items: center;
    padding: 12px 16px;
    background: white;
    border-radius: 8px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    gap: 16px;
}

.rate-type-badge {
    font-size: 11px;
    font-weight: 600;
    padding: 4px 8px;
    border-radius: 4px;
    min-width: 60px;
    text-align: center;
}

.rate-type-badge.sea { background: #dbeafe; color: #1e40af; }
.rate-type-badge.pre_carriage { background: #fef3c7; color: #92400e; }
.rate-type-badge.on_carriage { background: #dcfce7; color: #166534; }
.rate-type-badge.terminal { background: #f3e8ff; color: #6b21a8; }
.rate-type-badge.customs { background: #fee2e2; color: #991b1b; }

.rate-route {
    flex: 2;
    font-weight: 500;
}

.rate-container,
.rate-incoterm {
    flex: 1;
    color: #64748b;
    font-size: 13px;
}

.rate-price {
    flex: 1;
    font-weight: 600;
    color: #059669;
}

.rate-actions {
    display: flex;
    gap: 8px;
}

.btn-delete-rate {
    background: none;
    border: none;
    color: #ef4444;
    cursor: pointer;
    padding: 4px;
    border-radius: 4px;
}

.btn-delete-rate:hover {
    background: #fee2e2;
}

.loading-rates,
.error-rates,
.empty-rates {
    text-align: center;
    padding: 40px;
    color: #64748b;
}

.empty-rates .empty-icon {
    font-size: 48px;
    display: block;
    margin-bottom: 16px;
}

@keyframes slideIn {
    from { transform: translateX(100%); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
}

@keyframes slideOut {
    from { transform: translateX(0); opacity: 1; }
    to { transform: translateX(100%); opacity: 0; }
}
</style>
`;

// Inject styles when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        document.head.insertAdjacentHTML('beforeend', rateListStyles);
    });
} else {
    document.head.insertAdjacentHTML('beforeend', rateListStyles);
}

// Export functions for global use
window.saveSeaFreightRate = saveSeaFreightRate;
window.savePreCarriageRate = savePreCarriageRate;
window.saveOnCarriageRate = saveOnCarriageRate;
window.saveTerminalRate = saveTerminalRate;
window.saveForeignCustomsRate = saveForeignCustomsRate;
window.renderSavedRatesList = renderSavedRatesList;
window.deleteRate = deleteRate;
window.filterSavedRates = filterSavedRates;
window.switchRateTab = switchRateTab;
window.initFreightRatesModule = initFreightRatesModule;
