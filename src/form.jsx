Shift.EditorFor = React.createClass({
	displayName: 'ShiftEditorFor',
	render: function(){throw new Error("Should not be rendered")}
});
Shift.ValidationMessageFor = React.createClass({
	displayName: 'ShiftValidationMessageFor',
	render: function(){throw new Error("Should not be rendered")}
});

Shift.Form = React.createClass({
	displayName: 'ShiftForm',
	mixins: [Shift.Mixins.events, Shift.Mixins.translate],
	propTypes: {
		events: React.PropTypes.shape({
			onSubmit: React.PropTypes.function,
			onChange: React.PropTypes.function,
			onFieldInFocusChange: React.PropTypes.function,
			onSubmitBegin: React.PropTypes.function,
			onSubmitEnd: React.PropTypes.function
		}),
		fields: React.PropTypes.arrayOf(React.PropTypes.string),
		submitButtonId: React.PropTypes.string
	},
	getDefaultProps: function(){
		return {
			initialValue: {},
			idPrefix: 'form-',
			locale: 'en_US',
			context: null,
			submitButtonId: null
		};
	},
	translateCategoryName: function(category){
		if(this.props.categoryTranslations){
			if(this.props.categoryTranslations[this.props.locale]){
				return this.props.categoryTranslations[this.props.locale][category];
			}
		}

		return category;
	},
	getInitialState: function(){
		return {
			fieldInFocus: null,
			fieldErrors: this.getEmptyFieldErrors(),
			submittedOnce: false,
			presenterValues: this.props.initialValue || {}
		};
	},

	getEmptyFieldErrors: function(){
		var result = {};

		for(var key in this.props.schema){
			result[key] = {};
		}

		return result;
	},

	addArtificialRef: function(fieldName, ref){
		this.artificialRefs[fieldName] = ref;
	},
	removeArtificialRef: function(fieldName){
		delete this.artificialRefs[fieldName];
	},
	componentWillMount: function(){
		this.artificialRefs = {}
		this.validators = {};
		this.validatorsWithDependencies = {};
		this.validatorsDependingOnField = {};
		// We save this here as non-state.
		// React updates the state in some weird asynchronous way
		// we need a synchronous way of reading the state
		this.fieldErrors = this.getEmptyFieldErrors();

		for(var field in this.props.schema){
			this.validators[field] = [];
			this.validatorsDependingOnField[field] = [];
			this.validatorsWithDependencies[field] = [];
		}

		for(var field in this.props.schema){
			var schema = this.props.schema[field];
			if(schema.validators instanceof Array){
				var validators = this.normalizeValidators(schema.validators);
				for(var i in validators){
					var validator = validators[i];
					if(Object.keys(validator.dependencies).length == 0){
						this.validators[field].push(validator);
					} else {
						this.validatorsWithDependencies[field].push(validator);
						for(var key in validator.dependencies){
							var otherField = validator.dependencies[key];
							this.validatorsDependingOnField[otherField].push({field: field, validator: validator});
						}
					}
				}
			}
		}
	},
	componentWillUnmount: function(){
		this.validators = null;
		this.validatorsDependingOnField = null;
		this.fieldErrors = null;
	},

	defaultTemplate: [Shift.FieldsFor({key: 'fields'}, Shift.ValidationClassStatusFor({
			errorClassName: 'validation-error'
		}, [
			Shift.LabelFor({key: 'label'}),
			Shift.EditorFor({key: 'editor'}),
			Shift.ValidationMessageFor({key: 'validation'})
		])),
		Shift.CategoryFor({key: 'category'}, React.DOM.fieldset({}, [
			Shift.CategoryNameFor({tagName: 'legend', key: 'category-name'}),
			Shift.FieldsFor({key: 'fields'}, Shift.ValidationClassStatusFor({
				errorClassName: 'validation-error',
				key: 'validation'
			}, [
				Shift.LabelFor({key: 'label'}),
				Shift.EditorFor({key: 'editor'}),
				Shift.ValidationMessageFor({key: 'validation'})
			]))
		]))
	],

	getTemplate: function(){
		var canSubmit = !this.state.submitting //&& Object.keys(this.state.fieldErrors).length == 0;
		var template = this.props.template || this.defaultTemplate;
		if(template instanceof Array){
			template = template.slice(0);
		} else {
			template = [template];
		}
		// This button is here to enable the browsers default auto-submit form behavior
		// Doing it in this odd fashion seems to be the only reliable way of getting it to work in all browsers
		// even if there's no other submit button in the form. Safari won't accept a button with display:none
		// and IE11 even fails with visibility hidden
		template.push(React.DOM.input({key: 'shift-submit', type: 'submit', style:{
			height:0,
			width:0,
			display:'inline',
			margin: 0,
			padding: 0,
			borderWidth: 0
		}}));
		return React.DOM.form({onSubmit: this.formSubmitted}, template);
	},
	normalizeValidators: function(validators){
		return validators.map(function(e){
			if(['string','function'].indexOf(typeof(e)) >= 0){
				return new Shift.Validator(e, {}, {});
			}

			if(e instanceof Shift.Validator){
				return e;
			}

			var type = e.type;
			var params = e.params;
			var dependencies = e.dependencies;
			return new Shift.Validator(type, params, dependencies);
		});
	},
	getFields: function(){
		var fields = this.props.fields || Object.keys(this.props.schema);

		var result = [];

		for(var i in fields){
			var field = fields[i];

			if(this.props.schema[field].editor){
				result.push(field);
			}
		}

		return result;
	},
	getCategories: function(){
		var categories = this.props.categories || {};

		var result = {};

		for(var categoryName in categories){
			var fieldNames = categories[categoryName];

			var fields = [];

			for(var i in fields){
				var field = fields[i];

				if(this.props.schema[field].editor){
					fields.push(field);
				}
			}

			if(fields.length > 0){
				result[categoryName] = fields;
			}
		}

		return result;
	},
	render: function(){
		var that = this;
		var template = this.getTemplate();

		var templateMap = this.getTemplateMap();

		return utils.templateHelper(template, this.getFields(), this.getCategories(), function(category){
			return that.translateCategoryName(category);
		}, templateMap);
	},

	isFieldValid: function(fieldName){
		return typeof(this.state.fieldErrors[fieldName]) == 'undefined' || Object.keys(this.state.fieldErrors[fieldName]).length == 0;
	},

	getFieldErrorMessage: function(fieldName){
		var err = this.state.fieldErrors[fieldName];

		var keys = Object.keys(err);

		if(keys.length == 0){
			return '';
		}

		return this.translate(err[keys[0]]);
	},
	generateEditorId: function(fieldName){
		return this.props.idPrefix + fieldName;
	},
	getInitialFieldValue: function(fieldName){
		var initialValue = this.props.initialValue || {};
		return initialValue[fieldName];
	},
	getPresenterFieldValue: function(fieldName){
		return this.state.presenterValues[fieldName];
	},
	getTemplateMap: function(){
		var that = this;
		var result = [];

		var addArtificialRef = this.addArtificialRef;
		var removeArtificialRef = this.removeArtificialRef;

		result.push(Shift.EditorFor);
		result.push(function(fieldName, reactNode){
			var field = that.props.schema[fieldName];
			var value = that.getInitialFieldValue(fieldName);
			var opts = {
				className: utils.mergeClassNames(
					reactNode.props.className,
					reactNode.props.errorClassName,
					that.isFieldValid(fieldName)
				),
				context: that.props.context,
				locale: that.props.locale,
				editorId: that.generateEditorId(fieldName),
				submit: that.submit,
				events: {
					onChange: function(oldValue, newValue){
						that.valueChanged(fieldName, oldValue, newValue);
					},
					onFocus: function(){
						that.fieldFocused(fieldName);
					},
					onBlur: function(){
						that.fieldBlurred(fieldName);
					}
				}
			};
			if (!utils.isEmptyValue(value)){
				opts.initialValue = value;
			}
			return Shift.Editor({
				fieldName: fieldName,
				addRef: addArtificialRef,
				removeRef: removeArtificialRef,
				key: 'editor-' + fieldName,
				child: utils.unwrapEditor(field.editor)(utils.extend({}, field.editorProps, opts))
			})
		});

		result.push(Shift.LabelFor);
		result.push(function(fieldName, reactNode){
			var field = that.props.schema[fieldName];
			var tagName = reactNode.props.tagName;
			var className = reactNode.props.className;
			var errorClassName = reactNode.props.errorClassName;
			var label = field.label;

			if (field.editorLabel){
				label = field.editorLabel;
			}
			return Shift.Label({
				tagName: tagName,
				text: that.translate(label),
				editorId: that.generateEditorId(fieldName),
				key: 'label-' + fieldName,
				className: utils.mergeClassNames(
					className,
					errorClassName,
					that.isFieldValid(fieldName)
				)
			});
		});

		result.push(Shift.ValidationMessageFor);
		result.push(function(fieldName, reactNode){
			var className = reactNode.props.className;
			var tagName = reactNode.props.tagName ? reactNode.props.tagName : 'span';
			var errorClassName = reactNode.props.errorClassName;
			var isValid = that.isFieldValid(fieldName);
			var msg = that.getFieldErrorMessage(fieldName);

			return Shift.Label({
				tagName: tagName,
				text: msg,
				key: 'validation-message-' + fieldName,
				className: utils.mergeClassNames(
					className,
					errorClassName,
					that.isFieldValid(fieldName)
				)
			});
		});

		result.push(Shift.ValidationClassStatusFor);
		result.push(function(fieldName, reactNode){
			var className = reactNode.props.className;
			var tagName = reactNode.props.tagName;
			var errorClassName = reactNode.props.errorClassName;
			var isValid = that.isFieldValid(fieldName);

			return Shift.ValidationClassStatus({
				tagName: tagName,
				key: 'validation-class-status-' + fieldName,
				className: utils.mergeClassNames(
					className,
					errorClassName,
					that.isFieldValid(fieldName)
				)
			}, reactNode.props.children.map(function(child){
				return utils.templateHelper.replaceExplicitFields([], [], function(category){
					return that.translateCategoryName(category);
				}, child, result, fieldName);
			}));
		});

		result.push(Shift.PresenterFor);
		result.push(function(fieldName, reactNode){
			var field = that.props.schema[fieldName];
			return utils.unwrapPresenter(field.presenter)(utils.extend({}, field.presenterProps, {
				key: 'presenter-'+fieldName,
				value: that.getPresenterFieldValue(fieldName),
				className: reactNode.props.className,
				locale: that.props.locale,
				context: that.props.context
			}));
		});

		result.push(Shift.TitleFor);
		result.push(function(fieldName, reactNode){
			var field = that.props.schema[fieldName];
			var tagName = reactNode.props.tagName;
			var className = reactNode.props.className;
			return Shift.Title({
				tagName: tagName,
				key: 'title-' + fieldName,
				text: that.translate(field.label),
				className: className
			});
		});

		result.push(Shift.IfNonEmptyValueFor);
		result.push(function(fieldName, reactNode){
			var fieldValue = that.state.presenterValues[fieldName];
			if(utils.isEmptyValue(fieldValue)){
				return null;
			}

			return reactNode.props.children;
		});

		result.push(Shift.IfEmptyValueFor);
		result.push(function(fieldName, reactNode){
			var fieldValue = that.state.presenterValues[fieldName];
			if(utils.isEmptyValue(fieldValue)){
				return reactNode.props.children;
			}

			return null;
		});

		return result;
	},

	formSubmitted: function(e){
		e.preventDefault();
		e.stopPropagation();

		if(!this.state.submitting){
			this.submit(null, true);
		}
	},

	componentWillUpdate: function(nextProps, nextState){
		if(nextState.submitting != this.state.submitting){
			var submitButton = nextProps.submitButtonId ? document.getElementById(nextProps.submitButtonId) : null;
			if(nextState.submitting){
				if(submitButton){
					submitButton.disabled = 'disabled';
				}
				this.triggerEvent('onSubmitBegin');
			} else {
				if(submitButton){
					submitButton.removeAttribute("disabled");
				}
				this.triggerEvent('onSubmitEnd');
			}
		}
	},

	submit: function(){
		var defer = Shift.defer();
		var values = this.getValue();
		var that = this;
		this.setState({submitting: true, submittedOnce: true});
		this.validate(values).then(function(){
			if(that.hasEvent('onSubmit')){
				utils.async.whenAll([utils.ensurePromise(function(){
					return that.triggerEvent('onSubmit', [values]);
				})]).then(function(value){
					that.setState({submitting: false});
					defer.resolve(value[0]);
				}, function(error){
					that.setState({submitting: false});
					defer.reject(error);
				});
			} else {
				that.setState({submitting: false});
				defer.resolve();
			}
		}, function(errors){
			that.setState({submitting: false});
			defer.reject(errors);
		});

		return defer.promise;
	},
	hasEvent: function(name){
		if(this.props.events != null){
			return typeof(this.props.events[name]) == 'function';
		}

		return false;
	},

	getValue: function(){
		var result = {};
		for(var key in this.artificialRefs){
			var editor = this.artificialRefs[key];
			result[key] = editor.getValue();
		}
		return result;
	},

	setValue: function(values){
		var value = utils.extend({}, this.state.presenterValues);
		for(var key in values){
			var editor = this.artificialRefs[key];
			if(editor){
				editor.setValue(values[key]);
			}
			value[key] = values[key];
		}

		this.setState({presenterValues: value});
	},

	valueChanged: function(field, oldValue, newValue){
		this.triggerEvent('onChange', arguments);
	},
	// This function is quite complex
	//
	// What needs to be done is the following:
	// * Validate all simple field validators, that is
	//   validators that have no dependencies.
	//   If a single validator fails and is not asynchronous
	//   fail the validation early and exit.
	// * For each non-simple validation, schedule them to run
	//   after the fields they depend on have validated.
	//
	validate: function(values, setFocusOnFail){
		if(values == null){
			values = this.getValue();
		}
		if(setFocusOnFail == null){
			setFocusOnFail = false;
		}
		var allValidations = [];
		var fieldValidators = {};
		var fieldErrors = this.getEmptyFieldErrors();
		var that = this;

		// Run all simple validations
		// store the resulting promise both as a lookup of the actual field
		// and in an array containing all validations

		// This allows for use of the async utils whenAll and awaitAll to orchestrate the entire process
		for(var field in this.props.schema){
			(function(field){
				var simpleFieldPromise = this.validateSimpleFieldValidations(field, values, fieldErrors);
				allValidations.push(simpleFieldPromise);
				fieldValidators[field] = simpleFieldPromise;
			}).call(this, field);
		}

		for(field in this.props.schema){
			(function(field){
				var nonSimpleValidators = that.validatorsWithDependencies[field];
				if(nonSimpleValidators.length > 0){
					for(var i in nonSimpleValidators){
						(function(i){
							var validator = nonSimpleValidators[i];
							var deps = [fieldValidators[field]];
							var fieldValue = values[field];
							var dependencyValues = {};
							for(var key in validator.dependencies){
								deps.push(fieldValidators[validator.dependencies[key]]);
								dependencyValues[key] = values[validator.dependencies[key]];
							}

							allValidations.push(utils.async.whenAll(deps).then(function(){
								return utils.ensurePromise(function(){
									return validator.validate(fieldValue, dependencyValues);
								}).fail(function(error){
									that.setFieldError(field, validator, error, fieldErrors);
								});
							}));
						}).call(this, i);
					}
				}
			})(field);
		}

		var defer = Shift.defer();
		this.activeValidationPromise = defer.promise;
		var success = function(){
			if(that.activeValidationPromise == defer.promise){
				that.setState({fieldErrors: fieldErrors});
				this.fieldErrors = fieldErrors;
				that.activeValidationPromise = null;
			}
			defer.resolve();
		};
		var fail = function(){
			if(that.activeValidationPromise == defer.promise){
				that.setState({fieldErrors: fieldErrors});
				this.fieldErrors = fieldErrors;
				that.activeValidationPromise = null;
				if(setFocusOnFail){
					that.refs['field.editor.'+ Object.keys(this.fieldErrors)[0]].select();
				}
			}
			defer.reject(utils.extend({}, fieldErrors));
		};

		utils.async.awaitAll(allValidations).then(success, fail);

		return defer.promise;
	},
	validateSimpleFieldValidations: function(field, values, fieldErrors){
		var that = this;
		var fieldValidationResults = [];
		var fieldValue = values[field];
		var err = null;
		var fieldValidator = null;

		for(var i in this.validators[field]){
			var validator = this.validators[field][i];
			// We could simply turn everything here into a promise
			// However, if a validation fails and something else is going to
			// use a promise.
			// It would be very nice to not even have to run that validation
			try {
				var result = validator.validate(fieldValue);

				if (utils.isPromise(result)){
					(function(validator){
						result.then(function(){
							that.clearFieldError(field, validator, fieldErrors);
						}, function(err){
							that.setFieldError(field, validator, err, fieldErrors);
						});
					})(validator);
				} else {
					this.clearFieldError(field, validator, fieldErrors);
				}
				fieldValidationResults.push(result);
			} catch(error){
				var defer = Shift.defer();
				defer.reject();
				this.setFieldError(field, validator, error, fieldErrors);
				fieldValidator = defer.promise;
				break;
			}
		}
		// No point in doing whenAll when we already know we failed
		if(fieldValidator){
			return fieldValidator;
		}
		return utils.async.whenAll(fieldValidationResults);

	},
	validateField: function(field, values, setFocusOnFail){
		if(values == null){
			values = this.state.values;
		}
		if(setFocusOnFail == null){
			setFocusOnFail = false;
		}

		var fieldErrors = this.fieldErrors;


		var dependentValidators = this.validatorsDependingOnField[field];

		// First we need to get all the validators that depend on this field
		// and clear them
		for(var i in dependentValidators){
			var validatorInfo = dependentValidators[i];
			this.clearFieldError(validatorInfo.field, validatorInfo.validator, fieldErrors);
		}

		// next we clear potential errors on this field
		delete fieldErrors[field];

		var simpleValidate = this.validateSimpleFieldValidations(field, values, fieldErrors);

		simpleValidate.then(function(){

		});


	},
	setFieldError: function(field, sourceValidator, error, value){
		if(value == null){
			value = this.fieldErrors;
		}
		if(error == null){
			delete value[field][sourceValidator.id];
		} else {
			if(error.message != null){
				error = error.message;
			}
			if(typeof(value[field]) == 'undefined'){
				value[field] = {};
			}
			value[field][sourceValidator.id] = error;
		}
	},
	clearFieldError: function(field, sourceValidator, value){
		this.setFieldError(field, sourceValidator, null, value);
	},
	fieldFocused: function(fieldName){
		// Not using state. I do not want to re-render the entire form to get to this
		var oldFieldInFocus = this.fieldInFocus;
		if(fieldName != oldFieldInFocus){
			this.triggerEvent('onFieldInFocusChange', [fieldName]);
		}
		this.fieldInFocus = fieldName;
	},
	fieldBlurred: function(fieldName){
		var that = this;
		// When switching focus from one field to another
		// We do not want to first throw an event that says fieldInFocus is null
		// and then another event that states the new field is in focus
		// rather we only want the last event
		// throwing this event handler code back into the event loop seems to give us this behavior
		// at least in the tested version of chrome
		setTimeout(function(){
			if(that.state.submittedOnce){
				//that.validateField(fieldName);
			}
			if(that.fieldInFocus == fieldName){
				that.fieldInFocus = null;
				that.triggerEvent('onFieldInFocusChange', [null]);
			}
		}, 0);
	},

	focus: function(fieldName){
		if(fieldName in this.props.schema){
			var field = this.artificialRefs[fieldName];
			field.focus();
		}
	},

	blur: function(){
		if(this.fieldInFocus != null){
			this.artificialRefs[this.fieldInFocus].blur();
		}
	}
});