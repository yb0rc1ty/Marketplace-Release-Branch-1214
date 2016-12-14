angular.module('orderCloud')
	.config(checkoutPaymentConfig)
	.controller('CheckoutPaymentCtrl', CheckoutPaymentController)
	.directive('ocCheckoutPayment', OCCheckoutPayment)
;

function checkoutPaymentConfig($stateProvider) {
	$stateProvider
		.state('checkout.payment', {
			url: '/payment',
			templateUrl: 'checkout/payment/templates/checkout.payment.tpl.html',
			controller: 'CheckoutPaymentCtrl',
			controllerAs: 'checkoutPayment',
			resolve: {
                AvailableCreditCards: function(OrderCloud) {
                    return OrderCloud.Me.ListCreditCards(null, 1, 100);
                },
                AvailableSpendingAccounts: function(OrderCloud) {
                    return OrderCloud.Me.ListSpendingAccounts(null, 1, 100, null, null, {RedemptionCode: '!*', AllowAsPaymentMethod: true});
                }
			}
		})
    ;
}

function CheckoutPaymentController($state, $exceptionHandler, $rootScope, Underscore, toastr, OrderCloud, AddressSelectModal, MyPaymentCreditCardModal, OrderPayments, MyAddressesModal, AvailableCreditCards, AvailableSpendingAccounts, CurrentOrder, CheckoutConfig) {
	var vm = this;

    vm.next = function() {
        $state.go('checkout.review')
    };

    vm.creditCards = AvailableCreditCards.Items;
    vm.spendingAccounts = AvailableSpendingAccounts.Items;

    vm.currentOrderPayments = OrderPayments.Items;
    
    vm.paymentMethods = [
        {Display: 'Purchase Order', Value: 'PurchaseOrder'},
        {Display: 'Credit Card', Value: 'CreditCard'},
        {Display: 'Spending Account', Value: 'SpendingAccount'}//,
        //{Display: 'Pay Pal Express Checkout', Value: 'PayPalExpressCheckout'}
    ];

    vm.createAddress = createAddress;
    vm.changeBillingAddress = changeBillingAddress;
    vm.setCreditCard = SetCreditCard;
    vm.createCreditCard = CreateCreditCard;
    vm.setSpendingAccount = SetSpendingAccount;
    vm.setPaymentMethod = SetPaymentMethod;
    vm.createPayment = CreatePayment;
    vm.removePayment = RemovePayment;
    vm.canAddPayment = CanAddPayment;
    vm.patchPaymentAmount = PatchPaymentAmount;
    vm.setAmountMax = SetAmountMax;
    vm.savePONumber = SavePONumber;
    vm.expirationDateChange = ExpirationDateChange;


    function createAddress(){
        return MyAddressesModal.Create()
            .then(function(address) {
                toastr.success('Address Created', 'Success');
                CurrentOrder.BillingAddressID = address.ID;
                saveBillingAddress(CurrentOrder);
            });
    }

    function changeBillingAddress() {
        AddressSelectModal.Open('billing')
            .then(function(address) {
                if (address == 'create') {
                    createAddress();
                } else {
                    CurrentOrder.BillingAddressID = address.ID;
                    saveBillingAddress(CurrentOrder);
                }
            });
    }

    function saveBillingAddress(order) {
        if (order && order.BillingAddressID) {
            OrderCloud.Orders.Patch(order.ID, {BillingAddressID: order.BillingAddressID})
                .then(function(updatedOrder) {
                    $rootScope.$broadcast('OrderBillingAddressUpdated', updatedOrder);
                })
                .catch(function(ex) {
                    $exceptionHandler(ex);
                });
        }
    }

    function CreatePayment(order) {
        OrderCloud.Payments.Create(order.ID, {Type: vm.currentOrderPayments[0].Type})
            .then(function() {
                $state.reload();
            });
    }

    function RemovePayment(order, paymentIndex) {
        OrderCloud.Payments.Delete(order.ID, vm.currentOrderPayments[paymentIndex].ID)
            .then(function() {
                $state.reload();
            });
    }

    function SetPaymentMethod(order, paymentIndex) {
        if (!vm.currentOrderPayments[0].Amount) {
            // When Order Payment Method is changed it will clear out all saved payment information
            OrderCloud.Payments.Create(order.ID, {Type: vm.currentOrderPayments[paymentIndex].Type})
                .then(function() {
                    $state.reload();
                });
        }
        else {
            OrderCloud.Payments.Delete(order.ID, vm.currentOrderPayments[paymentIndex].ID)
                .then(function() {
                    OrderCloud.Payments.Create(order.ID, {Type: vm.currentOrderPayments[paymentIndex].Type})
                        .then(function() {
                            $state.reload();
                        });
                });
        }
    }

    function CreateCreditCard(order, paymentIndex){
        MyPaymentCreditCardModal.Create()
            .then(function(card) {
                toastr.success('Credit Card Created', 'Success');
                vm.creditCards.push(card);
                SetCreditCard(order, paymentIndex, card);
            });
    }

    function SetCreditCard(order, paymentIndex, card) {
        if (vm.currentOrderPayments[paymentIndex].Type === 'CreditCard') {
            OrderCloud.Payments.Patch(order.ID, vm.currentOrderPayments[paymentIndex].ID, {CreditCardID: card.ID})
                .then(function() {
                    $state.reload();
                });
        }
    }

    function SetSpendingAccount(order, paymentIndex, account) {
        if (vm.currentOrderPayments[paymentIndex].Type ==='SpendingAccount') {
            OrderCloud.Payments.Patch(order.ID, vm.currentOrderPayments[paymentIndex].ID, {SpendingAccountID: account.ID})
                .then(function() {
                    $state.reload();
                })
                .catch(function(err) {
                    OrderCloud.Payments.Patch(order.ID, vm.currentOrderPayments[paymentIndex].ID, {SpendingAccountID: null})
                        .then(function() {
                            $state.reload();
                            toastr.error(err.data.Errors[0].Message + ' Please choose another payment method or another spending account.', 'Error:')
                        });
                });
        }
    }

    function CanAddPayment(order, payments) {
        var paymentTotal = 0;
        angular.forEach(payments, function(payment) {
            paymentTotal += payment.Amount;
        });
        return ((paymentTotal < order.Total) && Underscore.pluck(vm.currentOrderPayments, ''));
    }

    function PatchPaymentAmount(order, paymentIndex) {
        if (vm.currentOrderPayments[paymentIndex].Amount && (vm.currentOrderPayments[paymentIndex].Amount <= vm.currentOrderPayments[paymentIndex].MaxAmount)) {
            OrderCloud.Payments.Patch(order.ID, vm.currentOrderPayments[paymentIndex].ID, {Amount: vm.currentOrderPayments[paymentIndex].Amount})
                .then(function() {
                    SetAmountMax(order);
                });
        }
    }

    function SetAmountMax(order) {
        angular.forEach(vm.currentOrderPayments, function(payment) {
            var maxAmount = order.Total - Underscore.reduce(Underscore.pluck(vm.currentOrderPayments, 'Amount'), function(a, b) {return a + b; });
            payment.MaxAmount = (payment.Amount + maxAmount).toString();
        });
    }

    function SavePONumber(paymentIndex, order) {
        !vm.currentOrderPayments[paymentIndex].xp ? vm.currentOrderPayments[paymentIndex].xp = {} : vm.currentOrderPayments[paymentIndex].xp;
        if (vm.currentOrderPayments[paymentIndex].Type === "PurchaseOrder") {
            OrderCloud.Payments.Update(order.ID, vm.currentOrderPayments[paymentIndex].ID, vm.currentOrderPayments[paymentIndex])
                .then(function(){
                    toastr.success('PO Number added to Order', 'Success:');
                })
        }
    }

    function ExpirationDateChange(paymentIndex) {
        if (vm.currentOrderPayments[paymentIndex].CreditCard && vm.currentOrderPayments[paymentIndex].CreditCard.ExpirationMonth && vm.currentOrderPayments[paymentIndex].CreditCard.ExpirationYear) {
            vm.currentOrderPayments[paymentIndex].CreditCard.ExpirationDate = new Date(vm.currentOrderPayments[paymentIndex].CreditCard.ExpirationYear, vm.currentOrderPayments[paymentIndex].CreditCard.ExpirationMonth, 0);
        }
    }
}

function OCCheckoutPayment() {
    return {
        restrict: 'E',
        templateUrl: 'checkout/payment/templates/payment.tpl.html'
    }
}
