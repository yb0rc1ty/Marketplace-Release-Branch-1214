angular.module('orderCloud')
	.config(checkoutReviewConfig)
	.controller('CheckoutReviewCtrl', CheckoutReviewController);

function checkoutReviewConfig($stateProvider) {
	$stateProvider
		.state('checkout.review', {
			url: '/review',
			templateUrl: 'checkout/review/templates/checkout.review.tpl.html',
			controller: 'CheckoutReviewCtrl',
			controllerAs: 'checkoutReview',
			resolve: {
				LineItemsList: function($q, $state, toastr, Underscore, OrderCloud, LineItemHelpers, CurrentOrder) {
					var dfd = $q.defer();
					OrderCloud.LineItems.List(CurrentOrder.ID)
						.then(function(data) {
							if (!data.Items.length) {
								dfd.resolve(data);
							}
							else {
								LineItemHelpers.GetProductInfo(data.Items)
									.then(function() {
										dfd.resolve(data);
									});
							}
						})
						.catch(function() {
							toastr.error('Your order does not contain any line items.', 'Error');
							dfd.reject();
						});
					return dfd.promise;
				},
				OrderPaymentsDetail: function(OrderCloud, OrderPayments) {
					angular.forEach(OrderPayments.Items, function(payment, index) {
						if (payment.Type === 'CreditCard' && payment.CreditCardID) {
							OrderCloud.Me.GetCreditCard(payment.CreditCardID)
								.then(function(cc) {
									OrderPayments.Items[index].Details = cc;
								})
								.catch(function(ex) {
									toastr.error(ex, 'Error');
								});
						}
						if (payment.Type === 'SpendingAccount' && payment.SpendingAccountID) {
							OrderCloud.Me.GetSpendingAccount(payment.SpendingAccountID)
								.then(function(sa) {
									OrderPayments.Items[index].Details = sa;
								})
								.catch(function(ex) {
									toastr.error(ex, 'Error');
								});
						}
					});
				}
			}
		});
}

function CheckoutReviewController(LineItemsList, OrderPayments) {
	var vm = this;
	vm.lineItems = LineItemsList;
	vm.payments = OrderPayments.Items;

}