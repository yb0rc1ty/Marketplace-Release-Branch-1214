angular.module('orderCloud')
	.config(checkoutConfig)
	.controller('CheckoutCtrl', CheckoutController)
    .factory('AddressSelectModal', AddressSelectModalService)
    .controller('AddressSelectCtrl', AddressSelectController)
    .constant('CheckoutConfig', {
        ShippingRates: true,
        MultipleShipments: false,
        TaxRates: false,
        MultiplePayments: false
    })
;

function checkoutConfig($stateProvider) {
	$stateProvider
		.state('checkout', {
			parent: 'base',
			url: '/checkout',
			templateUrl: 'checkout/templates/checkout.tpl.html',
			controller: 'CheckoutCtrl',
			controllerAs: 'checkout',
			resolve: {
                OrderShipAddress: function($q, OrderCloud, CurrentOrder){
                    var deferred = $q.defer();

                    if (CurrentOrder.ShippingAddressID) {
                        OrderCloud.Me.GetAddress(CurrentOrder.ShippingAddressID)
                            .then(function(address) {
                                deferred.resolve(address);
                            })
                            .catch(function(ex) {
                                deferred.resolve(null);
                            });
                    }
                    else {
                        deferred.resolve(null);
                    }

                    return deferred.promise;
                },
                CurrentPromotions: function(CurrentOrder, OrderCloud) {
                    return OrderCloud.Orders.ListPromotions(CurrentOrder.ID);
                },
                OrderBillingAddress: function($q, OrderCloud, CurrentOrder){
                    var deferred = $q.defer();

                    if (CurrentOrder.BillingAddressID) {
                        OrderCloud.Me.GetAddress(CurrentOrder.BillingAddressID)
                            .then(function(address) {
                                deferred.resolve(address);
                            })
                            .catch(function(ex) {
                                deferred.resolve(null);
                            });
                    }
                    else {
                        deferred.resolve(null);
                    }

                    return deferred.promise;
                },
                OrderPayments: function($q, OrderCloud, CurrentOrder) {
                    var deferred = $q.defer();
                    OrderCloud.Payments.List(CurrentOrder.ID)
                        .then(function(data) {
                            if (!data.Items.length) {
                                OrderCloud.Payments.Create(CurrentOrder.ID, {})
                                    .then(function(p) {
                                        deferred.resolve({Items: [p]});
                                    });
                            }
                            else {
                                deferred.resolve(data);
                            }
                        });

                    return deferred.promise;
                }
			}
		})
    ;
}

function CheckoutController($state, $rootScope, toastr, OrderCloud, CurrentOrder, OrderShipAddress, CurrentPromotions, OrderBillingAddress, OrderPayments, CheckoutConfig) {
    var vm = this;
    vm.currentOrder = CurrentOrder;
    vm.currentOrder.ShippingAddress = OrderShipAddress;
    vm.currentOrder.BillingAddress = OrderBillingAddress;
    vm.currentPromotions = CurrentPromotions.Items;
    vm.checkoutConfig = CheckoutConfig;
    vm.currentOrderPayments = OrderPayments.Items;

    vm.submitOrder = function() {
        OrderCloud.Orders.Submit(vm.currentOrder.ID)
            .then(function(order) {
                $state.go('confirmation', {orderid:order.ID}, {reload:'base'});
                toastr.success('Your order has been submitted', 'Success');
            })
            .catch(function(ex) {
                toastr.error('Your order did not submit successfully.', 'Error');
            });
    };

    function updateOrder(data) {
        vm.currentOrder.Subtotal = data.Subtotal;
        vm.currentOrder.Total = data.Total;
        vm.currentOrder.ShippingCost = data.ShippingCost;
        vm.currentOrder.PromotionDiscount = data.PromotionDiscount;
        updatePromotions();
    }

    function updatePromotions() {
        OrderCloud.Orders.ListPromotions(vm.currentOrder.ID)
            .then(function(data) {
                if (data.Meta) {
                    vm.currentPromotions = data.Items;
                } else {
                    vm.currentPromotions = data;
                }
            })
    }

    vm.orderIsValid = function() {
        var orderPaymentsTotal = 0;
        var validPaymentMethods = false;
        angular.forEach(vm.currentOrderPayments, function(payment) {
            orderPaymentsTotal += payment.Amount;
            validPaymentMethods = !!((payment.Type == 'SpendingAccount' && payment.SpendingAccountID != null) || (payment.Type == 'CreditCard' && payment.CreditCardID != null) || payment.Type == 'PurchaseOrder');
        });
        return !!(orderPaymentsTotal === vm.currentOrder.Subtotal && validPaymentMethods && vm.currentOrder.BillingAddress && vm.currentOrder.BillingAddress.ID != null);
    };

    // default state (if someone navigates to checkout -> checkout.shipping)
    if ($state.current.name === 'checkout') {
        $state.transitionTo('checkout.shipping');
    }

    $rootScope.$on('OrderShippingAddressChanged', function(event, order) {
        vm.currentOrder = order;
        OrderCloud.Me.GetAddress(order.ShippingAddressID)
            .then(function(address){
                vm.currentOrder.ShippingAddress = address;
            });
    });
    $rootScope.$on('OrderBillingAddressUpdated', function(event, order){
        vm.currentOrder = order;
    });

    $rootScope.$on('OC:UpdateOrder', function(event, OrderID) {
        OrderCloud.Orders.Get(OrderID)
            .then(function(data) {
                updateOrder(data);
            });
    });

    vm.removePromotion = function(promotion) {
        OrderCloud.Orders.RemovePromotion(vm.currentOrder.ID, promotion.Code)
            .then(function(data) {
                updateOrder(data);
            })
    };

    vm.getCardTypeClass = function(creditCard) {
        var result = 'fa-credit-card-alt';
        switch(creditCard.CardType.toLowerCase()) {
            case 'visa':
                result = 'fa-cc-visa';
                break;
            case 'mastercard':
                result = 'fa-cc-mastercard';
                break;
            case 'amex':
                result = 'fa-cc-amex';
                break;
            case 'diners club':
                result = 'fa-cc-diners-club';
                break;
            case 'discover':
                result = 'fa-cc-discover';
                break;
            case 'jcb':
                result = 'fa-cc-jcb';
                break;
            default:
                result = 'fa-credit-card-alt';
        }
        return result;
    }
}

function AddressSelectModalService($uibModal) {
    var service = {
        Open: _open
    };

    function _open(type) {
        return $uibModal.open({
            templateUrl: 'checkout/templates/addressSelect.modal.tpl.html',
            controller: 'AddressSelectCtrl',
            controllerAs: 'addressSelect',
            backdrop: 'static',
            size: 'md',
            resolve: {
                Addresses: function(OrderCloud) {
                    if (type == 'shipping') {
                        return OrderCloud.Me.ListAddresses(null, 1, 100, null, null, {Shipping: true});
                    } else if (type == 'billing') {
                        return OrderCloud.Me.ListAddresses(null, 1, 100, null, null, {Billing: true});
                    } else {
                        return OrderCloud.Me.ListAddresses(null, 1, 100);
                    }
                }
            }
        }).result;
    }

    return service;
}

function AddressSelectController($uibModalInstance, Addresses) {
    var vm = this;
    vm.addresses = Addresses;

    vm.select = function (address) {
        $uibModalInstance.close(address);
    };

    vm.createAddress = function() {
        $uibModalInstance.close('create');
    };

    vm.cancel = function () {
        $uibModalInstance.dismiss();
    };
}