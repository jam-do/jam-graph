import { UID } from '@symbiotejs/symbiote/utils/UID.js';

export class GNode {
  /**
   * 
   * @param {Partial<GNode>} src 
   */
  constructor(src = {}) {
    /** @type {String} */
    this.uid = null;
    /** @type {String} */
    this.type = src.type || null;
    /** @type {String} */
    this.subType = src.subType || null;
    /** @type {String[]} */
    this.connections = src.connections || [];
    /** @type {*} */
    this.value = src.value || Object.create(null);
    /** @type {Number} */
    this.timestamp = Date.now();
  }
}

export class JamGraph {

  /** @private */
  static __log(msg) {
    console.warn(msg);
  }

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
        this.__log(`JamGraph: ${id} - algetNodey exist`);
        return;
      } else {
        uid = id;
      }
    }
    node.uid = uid;

    this.store[uid] = node;
    return uid;
  }

  /** 
   * @param {*} data 
   * @param {String} type
   * @param {String} subType
   */
  static addData(data, type, subType) {
    let node = new GNode({
      value: data,
      type,
      subType,
    });
    return this.addNode(node);
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
      this.__log('JamGraph: unable to update node: ' + id);
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
    node.connections.forEach((uid) => {
      let connection = this.getNode(uid);
      if (connection.value !== dispatcher) {
        connection.value.update && connection.value.update(newData);
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
      this.__log('JamGraph: unable to update node: ' + id);
      return;
    }
    node.timestamp = Date.now();
    node.value[propertyName] = propertyValue;
    node.connections.forEach((uid) => {
      let connection = this.getNode(uid);
      if (connection.value !== dispatcher) {
        let callbackName = propertyName + 'Changed';
        connection.value[callbackName] && connection.value[callbackName](propertyValue);
      }
    });
  }

  /**
   *
   * @param {String} id
   */
  static deleteNode(id) {
    let node = this.getNode(id);
    node.connections.forEach((conId) => {
      let conNode = this.getNode(conId);
      this.disconnect(conNode.uid, id);
    });
    delete this.store[id];
  }

  /**
   *
   * @param {String} id
   * @param {String} hardId
   */
  static cloneNode(id, hardId = null) {
    let node = this.getNode(id);
    if (!node) {
      this.__log('JamGraph: unable to clone node: ' + id);
      return;
    }
    node.timestamp = Date.now();
    let newId = this.addNode(node, hardId);
    return newId;
  }

  /**
   *
   * @param {String} id
   * @param {String} conId
   */
  static connect(id, conId) {
    let node = this.getNode(id);
    let conNode = this.getNode(conId);
    if (node && conNode) {
      let concatArr = [...node.connections, conId];
      let uniqsSet = new Set(concatArr);
      node.connections = [...uniqsSet];
      conNode.value.update && conNode.value.update(node.value);
    } else {
      this.__log(`JamGraph: Could not connect ${id} & ${conId}`);
    }
  }

  /**
   *
   * @param {String} id
   * @param {String} conId
   */
  static connectDuplex(id, conId) {
    let node = this.getNode(id);
    let conNode = this.getNode(conId);
    if (node && conNode) {
      let concatArr = [...node.connections, conId];
      let uniqsSet = new Set(concatArr);
      node.connections = [...uniqsSet];

      let conConcatArr = [...conNode.connections, id];
      let conUniqSet = new Set(conConcatArr);
      conNode.connections = [...conUniqSet];
      conNode.value.update && conNode.value.update(node.value);
      node.value.update && node.value.update(conNode.value);
    } else {
      this.__log(`GraphStorage: Could not connect ${id} & ${conId}`);
    }
  }

  /**
   *
   * @param {String} nodeId
   * @param {String} connectionId
   */
  static disconnect(nodeId, connectionId) {
    let node = this.getNode(nodeId);
    if (node) {
      let set = new Set(node.connections);
      set.delete(connectionId);
      node.connections = [...set];
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
      } else if (node.type !== 'html-element') {
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
      } else if (type === 'html-element') {
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
    node.connections.forEach((uid) => {
      let connectedNode = this.getNode(uid);
      if (result[connectedNode.type]) {
        result[connectedNode.type].push(uid);
      } else {
        result[connectedNode.type] = [uid];
      }
    });
    return result;
  }

  /**
   *
   * @param {String} id
   * @returns {Object}
   */
  static getConnectionsBySubType(id) {
    let node = this.getNode(id);
    let result = Object.create(null);
    node.connections.forEach((uid) => {
      let connectedNode = this.getNode(uid);
      if (connectedNode.subType) {
        if (result[connectedNode.subType]) {
          result[connectedNode.subType].push(uid);
        } else {
          result[connectedNode.subType] = [uid];
        }
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
   * @param {String} subType
   * @returns {String[]}
   */
  static getBySubType(subType) {
    let result = [];
    this.keys.forEach((id) => {
      if (this.getNode(id).subType === subType) {
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
      let connections = this.getNode(id).connections;
      connections.forEach((connectionId) => {
        this.disconnect(connectionId, id);
      });
      delete this.store[id];
    });
  }

  /**
   *
   * @param {String} subType
   */
  static removeNodesBySubType(subType) {
    let subTypeArr = this.getBySubType(subType);
    subTypeArr.forEach((id) => {
      let connections = this.getNode(id).connections;
      connections.forEach((connectionId) => {
        this.disconnect(connectionId, id);
      });
      delete this.store[id];
    });
  }

  static clearStore() {
    this.store = Object.create(null);
  }

}

JamGraph.store = Object.create(null);