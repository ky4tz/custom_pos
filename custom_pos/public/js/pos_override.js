frappe.provide('erpnext.PointOfSale');

console.log("🚀 Custom POS Script v4 (Network Patch & Layout Fix)"); 

$(document).on('page-change', function() {
    if (frappe.get_route()[0] === 'point-of-sale') {
        setup_custom_pos_logic();
    }
});

if (frappe.get_route() && frappe.get_route()[0] === 'point-of-sale') {
    setTimeout(setup_custom_pos_logic, 1000);
}

function setup_custom_pos_logic() {
    if (window.pos_custom_observer_active) return;
    window.pos_custom_observer_active = true;

    // 1. Inject the UI perfectly below the payment modes list
    const observer = new MutationObserver((mutations) => {
        const payment_modes_list = document.querySelector('.payment-modes'); 
        
        if (payment_modes_list && !document.getElementById('custom-pos-fields')) {
            const custom_html = `
                <div id="custom-pos-fields" style="display:none; padding: 15px 0; margin-top: 15px; border-top: 1px solid var(--border-color);">
                    <div class="text-muted" style="margin-bottom: 12px; font-weight: 600; font-size: 11px; letter-spacing: 0.5px; text-transform: uppercase;">
                        Non-Cash Details
                    </div>
                    
                    <div class="control-input-wrapper" style="margin-bottom: 10px;">
                        <label class="control-label" style="font-size: 12px;">Name on Card / Bank Account</label>
                        <div class="control-input"><input type="text" id="pos_custom_name" class="input-with-feedback form-control input-xs"></div>
                    </div>
                    
                    <div class="control-input-wrapper" style="margin-bottom: 10px;">
                        <label class="control-label" style="font-size: 12px;">Last 4 Digits</label>
                        <div class="control-input"><input type="text" id="pos_custom_digits" class="input-with-feedback form-control input-xs" maxlength="4"></div>
                    </div>
                    
                    <div class="control-input-wrapper">
                        <label class="control-label" style="font-size: 12px;">Reference No. / Approval Code</label>
                        <div class="control-input"><input type="text" id="pos_custom_ref" class="input-with-feedback form-control input-xs"></div>
                    </div>
                </div>
            `;
            // Insert exactly after the list ends
            payment_modes_list.insertAdjacentHTML('afterend', custom_html);
        }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    // 2. Foolproof UI Toggle (Checks every 300ms what is currently selected)
    setInterval(() => {
        const active_mode = document.querySelector('.mode-of-payment.is-selected');
        const custom_fields_div = document.getElementById('custom-pos-fields');
        
        if (active_mode && custom_fields_div) {
            const payment_type = active_mode.getAttribute('data-payment-type');
            const mode_name = active_mode.getAttribute('data-mode');
            
            // If the system says it is Cash, hide it. Anything else (QRPh, Card, GCash), show it!
            if (payment_type === 'Cash' || mode_name === 'Cash') {
                custom_fields_div.style.display = 'none';
            } else {
                custom_fields_div.style.display = 'block';
            }
        }
    }, 300);

    // 3. The Network Interceptor (Blocks empty submissions & Injects Data)
    if (!window.pos_frappe_call_patched) {
        window.pos_frappe_call_patched = true;
        const original_frappe_call = frappe.call;
        
        frappe.call = function(options) {
            // Wait for the exact network request that saves the POS Invoice
            if (options.method === "erpnext.selling.page.point_of_sale.point_of_sale.create_invoice") {
                
                const custom_fields_div = document.getElementById('custom-pos-fields');
                const is_non_cash = custom_fields_div && custom_fields_div.style.display !== 'none';
                
                if (is_non_cash) {
                    const custom_name = $('#pos_custom_name').val();
                    const custom_digits = $('#pos_custom_digits').val();
                    const custom_ref = $('#pos_custom_ref').val();
                    
                    // VALIDATION BLOCKER
                    if (!custom_name || !custom_digits || !custom_ref) {
                        frappe.msgprint({
                            title: __('Missing Information'),
                            indicator: 'red',
                            message: __('Please enter the Name, Last 4 Digits, and Reference No. before completing a non-cash order.')
                        });
                        // Throwing a Promise Rejection properly unfreezes the "Complete Order" button
                        return Promise.reject("Missing Custom POS Fields"); 
                    }
                    
                    // DATA INJECTOR (Safely modifies the payload going to the server)
                    try {
                        if (options.args && options.args.doc) {
                            let doc = JSON.parse(options.args.doc);
                            doc.custom_name_on_cardbank_account = custom_name;
                            doc.custom_last_4_digits = custom_digits;
                            doc.custom_reference_noapproval_code = custom_ref;
                            options.args.doc = JSON.stringify(doc);
                        }
                    } catch (e) {
                        console.error("Failed to inject custom POS fields:", e);
                    }
                }
            }
            // Proceed with the network request
            return original_frappe_call.apply(this, arguments);
        };
    }
}
