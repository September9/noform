import React from 'react';
import PropTypes from 'prop-types';
import { ANY_CHANGE, BLUR, FOCUS } from '../static';

const Component = React.PureComponent;
const isFunction = func => typeof func === 'function';
const isObject = obj => Object.prototype.toString.call(obj) === '[object Object]';
const noop = () => { };

const getValue = (jsxProps) => {
    const hasVal = ('value' in jsxProps);
    const hasDefaultVal = ('defaultValue' in jsxProps);
    if (hasVal) {
        return jsxProps.value;
    } else if (hasDefaultVal) {
        return jsxProps.defaultValue;
    }
    return null;
};

class Item extends Component {
    static propTypes = {
        onBlur: PropTypes.func,
        onFocus: PropTypes.func,
        children: PropTypes.any,
        render: PropTypes.func,
        inset: PropTypes.bool,
    }
    static contextTypes = {
        form: PropTypes.object,
        ifCore: PropTypes.object,
    };
    static childContextTypes = {
        item: PropTypes.object,
        form: PropTypes.object,
        ifCore: PropTypes.object,
    };
    static defaultProps = {
        onBlur: noop,
        onFocus: noop,
    }

    constructor(jsxProps, context) {
        super(jsxProps, context);
        const { form } = context;
        this.form = form;
        const {
            name, error, children,
        } = jsxProps;

        const ftVal = getValue(jsxProps);

        // 构建时提前知道子类，比didmount再来通知，把控性好很多
        this.displayName = '';
        if (children) {
            if (React.isValidElement(children)) {
                const jsxComponent = React.Children.only(children);
                if (jsxComponent && jsxComponent.type && jsxComponent.type.displayName) {
                    this.displayName = jsxComponent.type.displayName;
                }
            }
        }

        this.predictChildForm = this.displayName === 'NoForm';

        const option = {
            error,
            value: ftVal,
            name,
        };

        // 上有if item
        if (context.ifCore) {
            option.when = context.ifCore.when;
            option.parentIf = context.ifCore.parentIf;
        } else if ('when' in jsxProps) {
            option.when = jsxProps.when;
        }

        // 处理props
        if ('props' in jsxProps) {
            if (isFunction(jsxProps.props)) {
                option.func_props = jsxProps.props;
                option.props = {};
            } else {
                option.props = jsxProps.props;
            }
        } else {
            option.props = {};
        }

        // 处理status
        if ('status' in jsxProps) {
            if (isFunction(jsxProps.status)) {
                option.func_status = jsxProps.status;
            } else {
                option.status = jsxProps.status;
            }
        }

        // 校验规则
        if ('validateConfig' in jsxProps) {
            if (isFunction(jsxProps.validateConfig)) {
                option.func_validateConfig = jsxProps.validateConfig;
            } else {
                option.validateConfig = jsxProps.validateConfig;
            }
        }

        if ('interceptor' in jsxProps) {
            option.interceptor = jsxProps.interceptor;
        }

        if ('id' in jsxProps) {
            option.id = jsxProps.id;
        }

        // 注册item, 绑定视图
        this.ifCore = context.ifCore;
        this.core = form.addField(option);
        this.core.jsx = this;
    }

    getChildContext() {
        // return { item: this, form: this.form, ifCore: null };
        return { item: this, form: this.form, ifCore: this.predictChildForm ? null : this.ifCore };
    }

    componentDidMount() {
        // 绑定更新函数
        this.core.on(ANY_CHANGE, this.update);
        if (this.childForm && !this.childForm.disabledSyncChildForm) {
            this.form.setValueSilent(this.core.name, this.childForm.getAll('value'));
            this.form.setProps(this.core.name, this.childForm.getAll('props'));
            this.form.setStatus(this.core.name, this.childForm.getAll('status'));
            this.form.setError(this.core.name, this.childForm.getAll('error'));
            this.childForm.on(ANY_CHANGE, (type) => {
                if (type === 'value') {
                    return;
                }

                this.form.set(type, this.core.name, this.childForm.getAll(type));
            });
        }
        this.didMount = true;
        this.forceUpdate();
    }
    // shouldComponentUpdate() {
    //     return false;
    // }
    componentWillUnmount() {
        this.core.removeListener(ANY_CHANGE, this.update);
        this.didMount = false;
    }
    onChange = (e, opts = {}) => {
        const { escape = false } = opts; // 直接用原生对象不进行判断

        let val = e;
        if (!escape) {
            if (e && e.target) {
                if ('value' in e.target) {
                    val = e.target.value;
                } else if ('checked' in e.target) {
                    val = e.target.checked;
                }
            }

            if (isObject(val)) {
                const tmpStr = JSON.stringify(val);
                try {
                    val = JSON.parse(tmpStr);
                } catch (exception) {
                    val = {};
                }
            }
        }

        this.form.currentCore = this.core;
        this.form.currentEventOpts = opts;
        this.form.currentEventType = 'manual';
        this.core.set('value', val);
        Promise.resolve().then(() => {
            this.form.currentCore = null;
            this.form.currentEventOpts = null;
            this.form.currentEventType = 'api';
        });
    }
    onBlur = () => {
        this.core.emit(BLUR, this.core.name);
        if (typeof this.props.onBlur === 'function') {
            this.props.onBlur();
        }
    }
    onFocus = () => {
        this.core.emit(FOCUS, this.core.name);
        if (typeof this.props.onFocus === 'function') {
            this.props.onFocus();
        }
    }
    bindForm = (childForm) => {
        this.childForm = childForm;
    }
    update = (type, name, value, silent = false) => {
        if (type === 'error') {
            return;
        }

        if (this.didMount && (this.props.render || this.core.name === name) && !silent) {
            this.forceUpdate();
        }
    }
    render() {
        if (this.props.render && this.didMount) {
            return this.props.render(this.form.getValue(), this.form);
        } else if (this.props.render) {
            return null;
        }

        if (this.didMount && this.core.get('status') === 'hidden') {
            return null;
        }

        if (typeof this.props.children === 'string') {
            throw new Error('string is not allowed as Item/FormItem\'s children.');
        }

        const { name } = this.core;
        const value = this.form.getItemValue(name);
        const props = this.form.getItemProps(name);
        const error = this.form.getItemError(name);
        const status = this.form.getItemStatus(name);

        const { onChange, onBlur, onFocus } = this;
        const {
            className,
            label,
            top,
            prefix,
            suffix,
            help,
            validateConfig,
            full,
            layout,
            when,
            ...others
        } = props || {};
        const { inset, style } = this.props;

        const component = React.Children.only(this.props.children);
        let disabled = false;

        if (status === 'disabled') {
            disabled = true;
        }

        const cloneProps = {
            inset,
            disabled,
            name,
            value,
            error,
            status,
            onChange,
            onBlur,
            onFocus,
            ...others,
        };

        if (style) {
            cloneProps.style = Object.assign({}, cloneProps.style || {}, style);
        }

        if (component && component.type && component.type.displayName === 'If') {
            delete cloneProps.name;
        }
        return React.cloneElement(component, cloneProps);
    }
}

Item.displayName = 'Item';

export default Item;
