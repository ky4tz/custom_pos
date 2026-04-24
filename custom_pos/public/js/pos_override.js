frappe.provide('erpnext.PointOfSale');

$(document).on('page-change', function() {
    if (frappe.get_route()[0] === 'point-of-sale') {
        setup_custom_pos_logic();
    }
});

function setup_custom_pos_logic() {
    const observer = new MutationObserver((mutations) => {
        const payment_container = document.querySelector('.payment-method-container'); 
        
        if (payment_container && !document.getElementById('custom-pos-fields')) {
            const custom_html = `
                <div id="custom-pos-fields" style="display:none; padding: 15px; background: var(--control-bg); border-radius: 8px; margin-top: 15px;">
                    <label style="font-size: 12px; color: var(--text-muted);">Name on Card / Bank Account</label>
                    <input type="text" id="pos_custom_name" class="form-control" style="margin-bottom: 10px;">
                    
                    <label style="font-size: 12px; color: var(--text-muted);">Last 4 Digits</label>
                    <input type="text" id="pos_custom_digits" class="form-control" style="margin-bottom: 10px;" maxlength="4">
                    
                    <label style="font-size: 12px; color: var(--text-muted);">Reference No. / Approval Code</label>
                    <input type="text" id="pos_custom_ref" class="form-control">
                </div>
            `;
            payment_container.insertAdjacentHTML('afterend', custom_html);
        }

        const active_method = document.querySelector('.mode-of-payment.is-selected');
        const custom_fields_div = document.getElementById('custom-pos-fields');
        
        if (active_method && custom_fields_div) {
            const method_name = active_method.innerText.trim();
            if (method_name !== 'Cash') {
                custom_fields_div.style.display = 'block';
            } else {
                custom_fields_div.style.display = 'none';
            }
        }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    setTimeout(() => {
        if (erpnext.PointOfSale && erpnext.PointOfSale.Controller) {
            const original_save = erpnext.PointOfSale.Controller.prototype.save_and_submit;
            
            erpnext.PointOfSale.Controller.prototype.save_and_submit = function() {
                const custom_name = $('#pos_custom_name').val();
                const custom_digits = $('#pos_custom_digits').val();
                const custom_ref = $('#pos_custom_ref').val();

                if (this.frm && this.frm.doc) {
                    this.frm.doc.custom_name_on_cardbank_account = custom_name;
                    this.frm.doc.custom_last_4_digits = custom_digits;
                    this.frm.doc.custom_reference_noapproval_code = custom_ref;
                }

                return original_save.call(this);
            };
        }
    }, 2000); 
}
