angular.module('orderCloud')
	.service('ProductQuickView', ProductQuickViewService)
	.controller('ProductQuickViewCtrl', ProductQuickViewController)
;

function ProductQuickViewService($uibModal) {
	var service = {
		Open: _open
	};

	function _open(currentOrder, product) {
		return $uibModal.open({
			backdrop:'static',
			templateUrl: 'productQuickView/templates/productQuickView.modal.tpl.html',
			controller: 'ProductQuickViewCtrl',
			controllerAs: 'productQuickView',
			size: 'lg',
			animation:false,
			resolve: {
				SelectedProduct: function() {
					return product;
				},
				CurrentOrder: function() {
					return currentOrder;
				}
			}
		}).result
	}

	return service;
}

function ProductQuickViewController(toastr, $uibModalInstance, SelectedProduct, CurrentOrder, LineItemHelpers) {
	var vm = this;
	vm.item = SelectedProduct;
	vm.addToCart = function() {
		LineItemHelpers.AddItem(CurrentOrder, vm.item)
			.then(function(){
				toastr.success('Product added to cart', 'Success');
				$uibModalInstance.close();
			})
	};

	vm.findPrice = function(qty){
		var finalPriceBreak = null;
		angular.forEach(vm.item.StandardPriceSchedule.PriceBreaks, function(priceBreak) {
			if (priceBreak.Quantity <= qty)
				finalPriceBreak = angular.copy(priceBreak);
		});

		return finalPriceBreak.Price * qty;
	};

	vm.cancel = function() {
		$uibModalInstance.dismiss();
	}
}