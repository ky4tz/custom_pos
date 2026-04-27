frappe.provide('erpnext.PointOfSale');

console.log("🚀 Custom POS Script v7 (Pre-Submit Blocker & Safe Injection)"); 

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

    // 1. COMPACT UI INJECTION (Unchanged - Perfect Layout)
    const observer = new MutationObserver(() => {
        const payment_modes_list = document.querySelector('.payment-modes'); 
        
        if (payment_modes_list && !document.getElementById('custom-pos-fields')) {
            const custom_html = `
                <div id="custom-pos-fields" style="display:none; padding: 12px; margin-top: 5px; border: 1px solid var(--border-color); border-radius: 8px; background: var(--control-bg);">
                    <div style="font-size: 10px; font-weight: 700; color: var(--text-muted); margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px;">
                        Non-Cash Details
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                        <div style="grid-column: span 2;">
                            <input type="text" id="pos_custom_name" class="form-control input-xs" placeholder="Name on Card / Bank Account" style="font-size: 12px; height: 28px;">
                        </div>
                        <div>
                            <input type="text" id="pos_custom_digits" class="form-control input-xs" maxlength="4" placeholder="Last 4 Digits" style="font-size: 12px; height: 28px;">
                        </div>
                        <div>
                            <input type="text" id="pos_custom_ref" class="form-control input-xs" placeholder="Ref No. / Approval" style="font-size: 12px; height: 28px;">
                        </div>
                    </div>
                </div>
            `;
            payment_modes_list.insertAdjacentHTML('beforeend', custom_html);
        }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    // 2. TOGGLE VISIBILITY
    $(document).on('click', '.payment-mode-wrapper', function() {
        const custom_fields_div = document.getElementById('custom-pos-fields');
        if (custom_fields_div) {
            const modeName = $(this).find('.mode-of-payment').attr('data-mode') || $(this).text().trim();
            if (modeName === 'Cash') {
                custom_fields_div.style.display = 'none';
            } else {
                custom_fields_div.style.display = 'block';
            }
        }
    });

    // 3. HARD UI BLOCKER: Intercepts BEFORE the "Confirm" popup or Network call
    setTimeout(() => {
        if (erpnext.PointOfSale && erpnext.PointOfSale.Controller) {
            const original_save = erpnext.PointOfSale.Controller.prototype.save_and_submit;
            
            erpnext.PointOfSale.Controller.prototype.save_and_submit = function() {
                const custom_fields_div = document.getElementById('custom-pos-fields');

                // If the fields are visible on the screen, enforce validation!
                if (custom_fields_div && custom_fields_div.style.display !== 'none') {
                    const custom_name = $('#pos_custom_name').val();
                    const custom_digits = $('#pos_custom_digits').val();
                    const custom_ref = $('#pos_custom_ref').val();

                    if (!custom_name || !custom_digits || !custom_ref) {
                        frappe.msgprint({
                            title: __('Missing Information'),
                            indicator: 'red',
                            message: __('Please enter the Name, Last 4 Digits, and Reference No. before completing a non-cash order.')
                        });

                        // Unfreeze the button manually so they can try again
                        const btn = document.querySelector('.submit-order-btn');
                        if (btn) {
                            btn.style.pointerEvents = 'auto';
                            btn.classList.remove('disabled');
                        }
                        
                        // RETURN EARLY: This stops the confirm popup from ever appearing!
                        return; 
                    }
                }

                // If fields are filled out, let Frappe's normal save continue
                return original_save.call(this);
            };
        }
    }, 2000);

    // 4. DATA INJECTOR: Safely inserts your data into the database payload
    if (!window.pos_frappe_call_patched) {
        window.pos_frappe_call_patched = true;
        const original_frappe_call = frappe.call;
        
        frappe.call = function(options) {
            if (options.method && options.method.includes("create_invoice")) {
                const custom_fields_div = document.getElementById('custom-pos-fields');
                
                // Only inject if the UI box was active
                if (custom_fields_div && custom_fields_div.style.display !== 'none') {
                    try {
                        if (options.args && options.args.doc) {
                            // Safely handle both String and Object payloads (Fixes the v6 bug!)
                            let is_string = typeof options.args.doc === 'string';
                            let doc_obj = is_string ? JSON.parse(options.args.doc) : options.args.doc;

                            doc_obj.custom_name_on_cardbank_account = $('#pos_custom_name').val();
                            doc_obj.custom_last_4_digits = $('#pos_custom_digits').val();
                            doc_obj.custom_reference_noapproval_code = $('#pos_custom_ref').val();

                            options.args.doc = is_string ? JSON.stringify(doc_obj) : doc_obj;
                        }
                    } catch (e) {
                        console.error("Custom POS Payload Injection Error:", e);
                    }
                }
            }
            return original_frappe_call.apply(this, arguments);
        };
    }
}
