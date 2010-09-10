/**
 * Saferpay Business Magento Payment Extension
 *
 * NOTICE OF LICENSE
 *
 * This source file is subject to the Open Software License (OSL 3.0)
 * that is bundled with this package in the file LICENSE.txt.
 * It is also available through the world-wide-web at this URL:
 * http://opensource.org/licenses/osl-3.0.php
 *
 * DISCLAIMER
 *
 * Do not edit or add to this file if you wish to upgrade Saferpay Business to
 * newer versions in the future. If you wish to customize Magento for your
 * needs please refer to http://www.magentocommerce.com for more information.
 *
 * @copyright Copyright (c) 2010 Openstream Internet Solutions, Switzerland
 * @license   http://opensource.org/licenses/osl-3.0.php  Open Software License (OSL 3.0)
 */

if(typeof Saferpay == 'undefined') {
	var Saferpay = {};
}

Saferpay.Business = Class.create({
	initialize: function() {
		payment.save = payment.save.wrap(function (origMethod) {
			if (checkout.loadWaiting != false) return;
			var validator = new Validation(this.form);
			if (this.validate() && validator.validate()) {
				saferpay.ccnum = '';
				saferpay.cccvc = '';
				saferpay.ccexpmonth = '';
				saferpay.ccexpyear = '';
				saferpay.elvacc = '';
				saferpay.elvbank = '';
				if (this.currentMethod && this.currentMethod.substr(0, 11) == 'saferpaybe_') {
					if (this.currentMethod == 'saferpaybe_cc') {
						saferpay.ccnum = $('saferpaybe_cc_cc_number').value;
						saferpay.cccvc = $('saferpaybe_cc_cc_cid').value;
						saferpay.ccexpmonth = $('saferpaybe_cc_expiration').value;
						saferpay.ccexpyear = $('saferpaybe_cc_expiration_yr').value;
					}
					else if (this.currentMethod == 'saferpaybe_elv') {
						saferpay.elvacc = $('saferpaybe_elv_account_number').value;
						saferpay.elvbank = $('saferpaybe_elv_bank_code').value;
					}
					saferpay.disableFields();
				}
				origMethod();
				if (this.currentMethod && this.currentMethod.substr(0, 11) == 'saferpaybe_') {
					saferpay.disableFields(false);

					review.save = review.save.wrap(function (origMethod) {
						saferpay.disableFields();
						//saferpay.clone3dsNotification();
						origMethod();
						saferpay.disableFields(false);
					});
					review.onSave = saferpay.processReviewResponse;
					review.onComplete = saferpay.updateLoadWaiting;
				}
			}
		});
	},
	disableFields: function(mode) {
		if (typeof mode == 'undefined') mode = true;
		var form = $('payment_form_' + payment.currentMethod);
		var elements = form.getElementsByClassName('no-submit');
		for (var i=0; i<elements.length; i++) elements[i].disabled = mode;
	},
	updateLoadWaiting: function(request)
	{
		var transport;
		if (request.transport) transport = request.transport;
		else transport = false;
		
		if (transport && transport.responseText) {
			try {
				var response = eval('(' + transport.responseText + ')');
				if (response.redirect) {
					/*
					 * Keep the spinner active
					 */
					return true;
				}
			}
			catch (e) {}
		}
		/*
		 * Some kind of error - deactivate the spinner
		 */
		checkout.setLoadWaiting(false);
	},
	processReviewResponse: function(request)
	{
		var transport;
		
		if (request.transport) transport = request.transport;
		else transport = false;
		if (payment.currentMethod && payment.currentMethod.substr(0, 11) == 'saferpaybe_') {
			if (transport && transport.responseText) {
				try {
					var response = eval('(' + transport.responseText + ')');
					if (response.redirect) {

						/*
						 * Display 3D-Secure notification
						 */
						var form = new Element('form', {'action': response.redirect, 'method': 'post', 'id': 'saferpay_be_transport'});
						$$('body')[0].insert(form);
						if (String(saferpay.ccnum).length > 0) {
							form.insert(new Element('input', {'type': 'hidden', 'name': 'sfpCardNumber', 'value':  saferpay.ccnum}));
							form.insert(new Element('input', {'type': 'hidden', 'name': 'sfpCardCvc', 'value':  saferpay.cccvc}));
							form.insert(new Element('input', {'type': 'hidden', 'name': 'sfpCardExpiryMonth', 'value':  saferpay.ccexpmonth}));
							form.insert(new Element('input', {'type': 'hidden', 'name': 'sfpCardExpiryYear', 'value':  saferpay.ccexpyear}));
						}
						else if (String(saferpay.elvbank).length > 0) {
							form.insert(new Element('input', {'type': 'hidden', 'name': 'sfpCardBLZ', 'value':  saferpay.elvbank}));
							form.insert(new Element('input', {'type': 'hidden', 'name': 'sfpCardKonto',  'value':  saferpay.elvacc}));
						}
						form.submit();
						
						return true;
					}
				}
				catch (e) {}
			}
		}
		review.nextStep(transport);
	},
	init3dsNotfications: function() {
		if ($('saferpaybe_cc_cc_type')) {
			Event.observe($('saferpaybe_cc_cc_type'), 'click', saferpay.update3dsNotification.bind(this));
			saferpay.update3dsNotification();
		}
	},
	update3dsNotification: function() {
		var ccOptions = $$('#saferpaybe_cc_cc_type option');
		if (ccOptions) {
			ccOptions.each(function(option) {
				var elementId = '3ds-notification-' + option.value;
				if ($(elementId)) {
					if (option.value == $F('saferpaybe_cc_cc_type')) {
						$(elementId).show();
					} else {
						$(elementId).hide();
					}
				}
			});
		}
	},
	clone3dsNotification: function() {
		if ($('saferpaybe_cc_cc_type') && $('checkout-review-load')) {
			var elementId = '3ds-notification-' + $F('saferpaybe_cc_cc_type');
			if ($(elementId)) {
				/*
				 * @todo add nice wrapping
				 */
				var notification = $(elementId).xml || $(elementId).outerHTML || $(elementId).wrap().innerHTML;
				notification = notification.replace(/id="3ds-notification-/, 'id="sp3ds-notification-clone');
				Element.insert($('checkout-review-load'), {after: notification});
			}
		}
	}
});

/*
 * Extend the cc validation scripts
 */
Validation.creditCartTypes = Validation.creditCartTypes.merge({
	'VP': [false, new RegExp('^([0-9]{3}|[0-9]{4})?$'), false],
	'BC': [false, new RegExp('^([0-9]{3}|[0-9]{4})?$'), false],
	'MO': [false, new RegExp('^([0-9]{3}|[0-9]{4})?$'), false],
	'UP': [false, new RegExp('^([0-9]{3}|[0-9]{4})?$'), false],
	'TC': [false, new RegExp('^([0-9]{3}|[0-9]{4})?$'), false]
});

Event.observe(window, 'load', function() {
	saferpay = new Saferpay.Business();
	saferpay.init3dsNotfications();
});
