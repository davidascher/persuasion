(function($) {

$.widget('ui.editable', {
	_init: function() {
		this.element.addClass('ui-editable');
		this.element.bind(this.options.eventStart, function(e) {
				var target = e.target;
				console.log(target);
				if (target.tagName == 'INPUT') {
								return false;
				}
				if (target.childNodes.length == 1 && target.firstChild.nodeType != 3) {
								return false;
				}
			$(this).editable('start');
		});
		if( this.options.sync ) {
			$(this.options.sync).val( this.element.text() );
		}
	},
	start: function() {
		var elem = this.element;
		if( !elem.data('editing') ) {
			elem.data('editing', true);
			$input = $('<input class="editable"/>').val( $(elem).text() ).width( $(elem).width() );
			$span = $('<span class="ui-inline" title="' + $(elem).text() + '" />').append($input)
			$(elem).html( $span );
			if( this.options.autoFocus ) $input.focus();
			if( this.options.autoSelect ) $input.select();
			$input.blur(function(e, d) {
				if( elem.editable('option', 'finishOnBlur') || d === true ) elem.editable('finish');
			});
			$input.keydown(function(e) {
				if( elem.editable('option', 'finishOnKey') && e.keyCode == elem.editable('option', 'finishOnKey')) $(this).trigger('blur', true);
			});
			elem.trigger(this.widgetEventPrefix + 'Start');
		}
	},
	finish: function() {
		var elem = this.element;
		if( elem.data('editing') ) {
			var validation = elem.editable('option', 'validation');
			var val = elem.find('input').val();
			if( ($.isFunction( validation ) && validation(val)) || ($.isFunction(validation.test) && validation.test(val)) || !validation) {
				if(this.options.sync) {
					$(this.options.sync).val( elem.find('input').val() );
					elem.text( elem.find('input').val() );
					elem.data('editing', false);
				} else {
					elem.text( elem.find('input').val() );
					elem.data('editing', false);
				}
				elem.trigger(this.widgetEventPrefix + 'Finish');
			}
		}
	},
	cancel: function() {
		var elem = this.element;
		if( elem.data('editing') ) {
			elem.text( elem.find('span').attr('title') );
			elem.data('editing', false);
			elem.trigger(this.widgetEventPrefix + 'Cancel');
		}
	},
});

$.extend($.ui.editable, {
	version: "0.1",
	eventPrefix: 'edit',
	defaults: {
		finishOnKey: 13,
		finishOnBlur: true,
		autoFocus: true,
		autoSelect: true,
		eventStart: 'dblclick',
		validation: false,
		buttons: {},
		sync: false
	}
});

})(jQuery);