export const Text = Symbol();
export const Comment = Symbol();

export function createRenderer(options = {}) {
    const { createElement, createTextNode, createCommentNode, setElementText, setText, insert, patchProps } = options;

    function render(vnode, container) {
        if (vnode) patch(container._vnode, vnode, container);
        else if (container._vnode) unmount(container._vnode);
        container._vnode = vnode;
    }

    function patch(oldVNode, newVNode, container) {
        if (oldVNode && oldVNode.type !== newVNode.type) {
            unmount(oldVNode);
            oldVNode = null;
        }
        const { type } = newVNode;
        if (typeof type === "string") {
            if (!oldVNode) mount(newVNode, container);
            else patchElement(oldVNode, newVNode);
        } else if (type === Text) {
            if (!oldVNode) {
                const el = (newVNode.el = createTextNode(newVNode.children));
                insert(el, container);
            } else {
                const el = (newVNode.el = oldVNode.el);
                if (newVNode.children !== oldVNode.children) setText(el, newVNode.children);
            }
        } else if (type === Comment) {
            if (!oldVNode) {
                const el = (newVNode.el = createCommentNode(newVNode.children));
                insert(el, container);
            } else {
                const el = (newVNode.el = oldVNode.el);
                if (newVNode.children !== oldVNode.children) setText(el, newVNode.children);
            }
        } else if (typeof type === "object") {
            //  处理组件
        } else if (typeof type === "xxx") {
            //  处理其他类型的vnode
        }
    }

    function patchElement(oldVNode, newVNode) {
        const el = (newVNode.el = oldVNode.el);
        const oldProps = oldVNode.props;
        const newProps = newVNode.props;
        for (const key in newProps) {
            if (newProps[key] !== oldProps[key]) {
                patchProps(el, key, oldProps[key], newProps[key]);
            }
        }
        for (const key in oldProps) {
            if (!(key in newProps)) patchProps(el, key, oldProps[key], null);
        }
        patchChildren(oldVNode, newVNode, el);
    }

    function patchChildren(oldVNode, newVNode, container) {
        if (typeof newVNode.children === "string") {
            if (Array.isArray(oldVNode.children)) {
                oldVNode.children.forEach((c) => unmount(c));
            }
            setElementText(container, newVNode.children);
        } else if (Array.isArray(newVNode.children)) {
            if (Array.isArray(oldVNode.children)) {
                //  Diff算法
                oldVNode.children.forEach((c) => unmount(c));
                newVNode.children.forEach((c) => patch(null, c, container));
            } else {
                setElementText(container, "");
                newVNode.children.forEach((c) => patch(null, c, container));
            }
        } else {
            if (Array.isArray(oldVNode.children)) {
                oldVNode.children.forEach((c) => unmount(c));
            } else if (typeof oldVNode.children === "string") {
                setElementText(container, "");
            }
        }
    }

    function mount(vnode, container) {
        const el = (vnode.el = createElement(vnode.type));
        if (typeof vnode.children === "string") setElementText(el, vnode.children);
        else if (Array.isArray(vnode.children))
            vnode.children.forEach((child) => {
                patch(null, child, el);
            });
        if (vnode.props) {
            for (const key in vnode.props) {
                patchProps(el, key, null, vnode.props[key]);
            }
        }
        insert(el, container);
    }

    function unmount(vnode) {
        const parent = vnode.el.parentNode;
        if (parent) parent.removeChild(vnode.el);
    }

    return {
        render,
    };
}

function shouldSetAsProps(el, key) {
    if (key === "from" && el.tagName === "INPUT") return false;
    return key in el;
}

function normalizeClass(value) {
    let res = "";
    if (typeof value === "string") res = value;
    else if (Array.isArray(value)) {
        for (let i = 0; i < value.length; ++i) {
            const normalized = normalizeClass(value[i]);
            if (normalized) res += normalized + " ";
        }
    } else if (typeof value === "object") {
        for (const name in value) {
            if (value[name]) res += name + " ";
        }
    }
    return res.trim();
}

export const renderer = createRenderer({
    createElement(tag) {
        return document.createElement(tag);
    },
    createTextNode(text) {
        return document.createTextNode(text);
    },
    createCommentNode(text) {
        return document.createComment(text);
    },
    setText(el, text) {
        el.nodeValue = text;
    },
    setElementText(el, text) {
        el.textContent = text;
    },
    insert(el, parent, anchor = null) {
        parent.insertBefore(el, anchor);
    },
    patchProps(el, key, prevValue, nextValue) {
        if (/^on/.test(key)) {
            const invokers = el._vei || (el._vei = {}); //   vue event invoker
            let invoker = invokers[key];
            const name = key.slice(2).toLowerCase();
            if (nextValue) {
                if (!invoker) {
                    invoker = el._vei[key] = (e) => {
                        if (e.timeStamp < invoker.attached) return;
                        if (Array.isArray(invoker.value)) {
                            invoker.value.forEach((fn) => {
                                fn(e);
                            });
                        } else invoker.value(e);
                    };
                    invoker.value = nextValue;
                    invoker.attached = performance.now();
                    el.addEventListener(name, invoker);
                } else invoker.value = nextValue;
            } else if (invoker) {
                el.removeEventListener(name, invoker);
            }
        } else if (key === "class") {
            nextValue = normalizeClass(nextValue);
            el.className = nextValue;
        } else if (shouldSetAsProps(el, key)) {
            const type = typeof el[key];
            if (type === "boolean" && nextValue === "") el[key] = true;
            else el[key] = nextValue;
        }
    },
});
