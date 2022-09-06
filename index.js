import { UID } from '@symbiotejs/symbiote/utils/UID.js';

function log(msg) {
  console.warn('JamGraph: ' + msg);
}
export class GNode {
  /**
   * 
   * @param {Partial<GNode>} src 
   */
  constructor(src = {}) {
    /** @type {String} */
    this.uid = null;
    /** @type {String} */
    this.type = src.type || 'NONE';
    /** @type {String[]} */
    this.links = src.links || [];
    /** @type {*} */
    this.value = src.value || Object.create(null);
    /** @type {Boolean} */
    this.serializable = true;
    /** @type {Number} */
    this.timestamp = Date.now();
  }
}

export class JamGraph {

  /** @type {Object<string, GNode>} */
  static store = Object.create(null);

  /** 
   * @private 
   * @type {Map<Function,number>}
   */
  static __timeoutsMap = new Map();

  /** 
   * @private
   * @type {Object<string,Set<Function>>}
   */
  static __cbMap = Object.create(null);

  /**
   *
   * @param {GNode} node
   * @param {String} id
   * @returns {String}
   */
  static addNode(node, id = null) {
    let uid;
    if (!id) {
      uid = UID.generate();
      while (this.store[uid]) {
        uid = UID.generate();
      }
    } else {
      if (this.store[id]) {
        log(`${id} - already exist`);
        return;
      } else {
        uid = id;
      }
    }
    node.uid = uid;

    this.store[uid] = node;
    node.type && this.notify(node.type);
    return uid;
  }

  /** 
   * @param {*} data 
   * @param {String} type
   */
  static addData(data, type) {
    let node = new GNode({
      value: data,
      type,
    });
    let nodeId = this.addNode(node);
    this.notify(node.type);
    return nodeId;
  }

  /**
   *
   * @param {String} id
   * @returns {GNode}
   */
  static getNode(id) {
    return this.store[id];
  }

  /**
   *
   * @param {String[]} idArr
   * @returns {GNode[]}
   */
  static getNodes(idArr) {
    return idArr.map((id) => {
      return this.getNode(id);
    });
  }

  /**
   *
   * @param {String} id
   */
  static getValue(id) {
    return this.getNode(id).value;
  }

  /**
   *
   * @param {String[]} idArr
   */
  static getValues(idArr) {
    return this.getNodes(idArr).map((node) => {
      return node.value;
    });
  }

  /**
   *
   * @param {String} id
   * @param {*} newData
   * @param {*} dispatcher
   */
  static update(id, newData, dispatcher = null) {
    let node = this.getNode(id);
    if (!node) {
      log('unable to update node: ' + id);
      return;
    }
    node.timestamp = Date.now();
    let primitives = [
      String,
      Number,
      Symbol,
    ];
    if (primitives.includes(node.value.constructor)) {
      node.value = newData;
    } else {
      Object.assign(node.value, newData);
    }
    node.links.forEach((uid) => {
      let linked = this.getNode(uid);
      if (linked.value !== dispatcher) {
        linked.value?.update(newData);
      }
    });
  }

  /**
   *
   * @param {String} id
   * @param {String} propertyName
   * @param {*} propertyValue
   * @param {*} dispatcher
   */
  static setProperty(id, propertyName, propertyValue, dispatcher = null) {
    let node = this.getNode(id);
    if (!node) {
      log('unable to set property. Node is not found: ' + id);
      return;
    }
    node.timestamp = Date.now();
    node.value[propertyName] = propertyValue;
    node.links.forEach((uid) => {
      let link = this.getNode(uid);
      if (link.value !== dispatcher) {
        let callbackName = propertyName + 'Changed';
        link.value[callbackName] && link.value[callbackName](propertyValue);
      }
    });
  }

  /**
   *
   * @param {String} id
   */
  static deleteNode(id) {
    let node = this.getNode(id);
    node.links.forEach((conId) => {
      let conNode = this.getNode(conId);
      this.unlink(conNode.uid, id);
    });
    delete this.store[id];
    this.notify(node.type);
  }

  /**
   *
   * @param {String} id
   * @param {String} hardId
   */
  static cloneNode(id, hardId = null) {
    let node = this.getNode(id);
    if (!node) {
      log('unable to clone node: ' + id);
      return;
    }
    node.timestamp = Date.now();
    let newId = this.addNode(node, hardId);
    this.notify(node.type);
    return newId;
  }

  /**
   *
   * @param {String} id
   * @param {String} conId
   */
  static link(id, conId) {
    let node = this.getNode(id);
    let conNode = this.getNode(conId);
    if (node && conNode) {
      let concatArr = [...node.links, conId];
      let uniqsSet = new Set(concatArr);
      node.links = [...uniqsSet];
      conNode.value.update && conNode.value.update(node.value);
    } else {
      log(`could not link ${id} & ${conId}`);
    }
  }

  /**
   *
   * @param {String} id
   * @param {String} conId
   */
  static linkDuplex(id, conId) {
    let node = this.getNode(id);
    let conNode = this.getNode(conId);
    if (node && conNode) {
      let concatArr = [...node.links, conId];
      let uniqsSet = new Set(concatArr);
      node.links = [...uniqsSet];

      let conConcatArr = [...conNode.links, id];
      let conUniqSet = new Set(conConcatArr);
      conNode.links = [...conUniqSet];
      conNode.value.update && conNode.value.update(node.value);
      node.value.update && node.value.update(conNode.value);
    } else {
      log(`could not link ${id} & ${conId}`);
    }
  }

  /**
   *
   * @param {String} nodeId
   * @param {String} linkId
   */
  static unlink(nodeId, linkId) {
    let node = this.getNode(nodeId);
    if (node) {
      let set = new Set(node.links);
      set.delete(linkId);
      node.links = [...set];
    }
  }

  /**
   * @returns {String[]}
   */
  static get keys() {
    return Object.keys(this.store);
  }

  /**
   *
   * @param {String} query
   * @param {String} fieldName
   * @returns {String[]}
   */
  static find(query, fieldName = null) {
    let result = [];
    this.keys.forEach((id) => {
      let str = '';
      let node = this.getNode(id);
      if (fieldName && node.value[fieldName]) {
        str = JSON.stringify(node.value[fieldName]);
      } else if (node.serializable) {
        str = JSON.stringify(node.value);
      }
      if (str.includes(query)) {
        result.push(id);
      }
    });
    return result;
  }

  /**
   *
   * @param {String} type
   * @param {String} query
   * @param {String} fieldName
   * @returns {String[]}
   */
  static findInType(type, query, fieldName = null) {
    let result = [];
    let byTypeIdArr = this.getByType(type);
    byTypeIdArr.forEach((id) => {
      let str = '';
      let node = this.getNode(id);
      if (fieldName && node.value[fieldName]) {
        str = JSON.stringify(node.value[fieldName]);
      } else if (!node.serializable) {
        let cleanObj = {};
        for (let prop in node.value) {
          if (typeof node.value[prop] === 'string') {
            cleanObj[prop] = node.value[prop];
          }
        }
        str = JSON.stringify(cleanObj);
      } else {
        str = JSON.stringify(node.value);
      }
      if (str.includes(query)) {
        result.push(id);
      }
    });
    return result;
  }

  /**
   *
   * @param {String} id
   * @returns {Object}
   */
  static getConnectionsByType(id) {
    let node = this.getNode(id);
    let result = Object.create(null);
    node.links.forEach((uid) => {
      let linkedNode = this.getNode(uid);
      if (result[linkedNode.type]) {
        result[linkedNode.type].push(uid);
      } else {
        result[linkedNode.type] = [uid];
      }
    });
    return result;
  }

  /**
   *
   * @param {String} type
   * @returns {String[]}
   */
  static getByType(type) {
    let result = [];
    this.keys.forEach((id) => {
      if (this.getNode(id).type === type) {
        result.push(id);
      }
    });
    return result;
  }

  /**
   *
   * @param {String} type
   */
  static removeNodesByType(type) {
    let typeArr = this.getByType(type);
    typeArr.forEach((id) => {
      let links = this.getNode(id).links;
      links.forEach((linkId) => {
        this.unlink(linkId, id);
      });
      delete this.store[id];
    });
  }

  /**
   * 
   * @param {String} type 
   * @param {(list:String[]) => void} callback
   * @param {Boolean} [init]
   * @returns 
   */
  static subscribeOnType(type, callback, init = true) {
    if (!this.__cbMap[type]) {
      this.__cbMap[type] = new Set();
    }
    this.__cbMap[type].add(callback);
    if (init) {
      this.debounce(callback, [this.getByType(type)]);
    }
    return {
      remove: () => {
        this.__cbMap[type].delete(callback);
        if (!this.__cbMap[type].size) {
          delete this.__cbMap[type];
        }
      },
    };
  }

  /**
   * 
   * @param {Function} callback 
   * @param  {...any} args 
   */
  static debounce(callback, ...args) {
    let timeout = this.__timeoutsMap.get(callback);
    if (timeout) {
      clearTimeout(timeout);
    }
    this.__timeoutsMap.set(callback, setTimeout(() => {
      callback(...args);
    }));
  }

  /**
   * 
   * @returns {String[]}
   */
  static getTypes() {
    let typeList = new Set();
    this.keys.forEach((id) => {
      let node = this.getNode(id);
      typeList.add(node.type);
    });
    return [...typeList];
  }

  /**
   * 
   * @param {String} type 
   */
  static notify(type) {
    this.__cbMap[type].forEach((cb) => {
      this.debounce(cb, [this.getByType(type)]);
    });
  }

  static get serializedStore() {
    let serialized = {};
    this.keys.forEach((id) => {
      let node = this.getNode(id);
      if (node.serializable) {
        serialized[id] = node;
      }
    });
    return serialized;
  }

  static clearStore() {
    this.store = Object.create(null);
  }

}
