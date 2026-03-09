/**
 * EvoHub Crypto Utilities
 * 生成 node_id, node_secret, asset_id 等安全标识符
 */

const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

// ID 前缀定义
const ID_PREFIXES = {
  NODE: 'node',
  SECRET: 'secret',
  ASSET: 'asset',
  DECISION: 'decision',
  TASK: 'task',
  SESSION: 'sess'
};

/**
 * 生成带前缀的唯一 ID
 * @param {string} prefix - ID 前缀
 * @param {number} randomBytes - 随机字节数
 * @returns {string} 唯一 ID
 */
function generateId(prefix, randomBytes = 8) {
  const timestamp = Date.now().toString(36);
  const random = crypto.randomBytes(randomBytes).toString('hex');
  return `${prefix}_${timestamp}_${random}`;
}

/**
 * 生成节点 ID
 * @returns {string} node_id
 */
function generateNodeId() {
  return generateId(ID_PREFIXES.NODE);
}

/**
 * 生成节点密钥
 * @returns {string} node_secret
 */
function generateNodeSecret() {
  return generateId(ID_PREFIXES.SECRET, 16);
}

/**
 * 生成资产 ID
 * @returns {string} asset_id
 */
function generateAssetId() {
  return generateId(ID_PREFIXES.ASSET);
}

/**
 * 生成决策 ID
 * @returns {string} decision_id
 */
function generateDecisionId() {
  return generateId(ID_PREFIXES.DECISION);
}

/**
 * 生成任务 ID
 * @returns {string} task_id
 */
function generateTaskId() {
  return generateId(ID_PREFIXES.TASK);
}

/**
 * 生成会话 ID
 * @returns {string} session_id
 */
function generateSessionId() {
  return generateId(ID_PREFIXES.SESSION);
}

/**
 * 生成 UUID v4
 * @returns {string} UUID
 */
function generateUUID() {
  return uuidv4();
}

/**
 * 计算 SHA256 哈希
 * @param {string|object|Buffer} data - 要哈希的数据
 * @returns {string} SHA256 哈希值（hex）
 */
function computeSHA256(data) {
  let input;
  
  if (Buffer.isBuffer(data)) {
    input = data;
  } else if (typeof data === 'object') {
    input = JSON.stringify(data, Object.keys(data).sort());
  } else {
    input = String(data);
  }
  
  return crypto.createHash('sha256').update(input).digest('hex');
}

/**
 * 计算 HMAC-SHA256
 * @param {string} data - 要签名的数据
 * @param {string} secret - 密钥
 * @returns {string} HMAC 签名
 */
function computeHMAC(data, secret) {
  return crypto
    .createHmac('sha256', secret)
    .update(String(data))
    .digest('hex');
}

/**
 * 生成随机令牌
 * @param {number} length - 令牌长度（字节）
 * @returns {string} Base64 编码的随机令牌
 */
function generateToken(length = 32) {
  return crypto.randomBytes(length).toString('base64url');
}

/**
 * 生成安全随机数
 * @param {number} min - 最小值
 * @param {number} max - 最大值
 * @returns {number} 安全随机数
 */
function secureRandom(min, max) {
  const range = max - min;
  const randomBytes = crypto.randomBytes(4);
  const randomValue = randomBytes.readUInt32BE(0);
  return min + (randomValue % range);
}

/**
 * 生成一次性密码（OTP）
 * @param {number} digits - 位数
 * @returns {string} OTP
 */
function generateOTP(digits = 6) {
  const min = Math.pow(10, digits - 1);
  const max = Math.pow(10, digits);
  return String(secureRandom(min, max)).padStart(digits, '0');
}

/**
 * 生成 API Key
 * @returns {string} API Key
 */
function generateApiKey() {
  const prefix = 'evohub';
  const random = crypto.randomBytes(24).toString('base64url');
  return `${prefix}_${random}`;
}

/**
 * 验证 ID 格式
 * @param {string} id - 要验证的 ID
 * @param {string} expectedPrefix - 期望的前缀
 * @returns {boolean} 是否有效
 */
function isValidId(id, expectedPrefix) {
  if (!id || typeof id !== 'string') return false;
  
  const parts = id.split('_');
  if (parts.length !== 3) return false;
  
  const [prefix, timestamp, random] = parts;
  
  if (expectedPrefix && prefix !== expectedPrefix) return false;
  
  // 验证时间戳
  const ts = parseInt(timestamp, 36);
  if (isNaN(ts) || ts < 1609459200000 || ts > Date.now() + 86400000) {
    return false;
  }
  
  // 验证随机部分（hex）
  if (!/^[a-f0-9]+$/.test(random)) return false;
  
  return true;
}

/**
 * 验证 node_id 格式
 * @param {string} nodeId - 节点 ID
 * @returns {boolean} 是否有效
 */
function isValidNodeId(nodeId) {
  return isValidId(nodeId, ID_PREFIXES.NODE);
}

/**
 * 验证 asset_id 格式
 * @param {string} assetId - 资产 ID
 * @returns {boolean} 是否有效
 */
function isValidAssetId(assetId) {
  return isValidId(assetId, ID_PREFIXES.ASSET);
}

/**
 * 加密敏感数据（对称加密）
 * @param {string} text - 要加密的数据
 * @param {string} key - 加密密钥（32字节）
 * @returns {object} 加密结果 { iv, encrypted }
 */
function encrypt(text, key) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(key, 'hex'), iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  return {
    iv: iv.toString('hex'),
    encrypted,
    authTag: authTag.toString('hex')
  };
}

/**
 * 解密数据
 * @param {object} encryptedData - 加密结果 { iv, encrypted, authTag }
 * @param {string} key - 解密密钥
 * @returns {string} 解密后的数据
 */
function decrypt(encryptedData, key) {
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    Buffer.from(key, 'hex'),
    Buffer.from(encryptedData.iv, 'hex')
  );
  
  decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));
  
  let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

/**
 * 生成密钥对（用于签名验证）
 * @returns {object} { publicKey, privateKey }
 */
function generateKeyPair() {
  return crypto.generateKeyPairSync('ed25519', {
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
  });
}

/**
 * 签名数据
 * @param {string} data - 要签名的数据
 * @param {string} privateKey - 私钥
 * @returns {string} 签名
 */
function sign(data, privateKey) {
  const signer = crypto.createSign('sha256');
  signer.update(data);
  return signer.sign(privateKey, 'base64');
}

/**
 * 验证签名
 * @param {string} data - 原始数据
 * @param {string} signature - 签名
 * @param {string} publicKey - 公钥
 * @returns {boolean} 签名是否有效
 */
function verify(data, signature, publicKey) {
  const verifier = crypto.createVerify('sha256');
  verifier.update(data);
  return verifier.verify(publicKey, signature, 'base64');
}

// 别名：hashData = computeSHA256
const hashData = computeSHA256;

module.exports = {
  // ID 生成
  generateId,
  generateNodeId,
  generateNodeSecret,
  generateAssetId,
  generateDecisionId,
  generateTaskId,
  generateSessionId,
  generateUUID,
  
  // 哈希与签名
  computeSHA256,
  hashData,
  computeHMAC,
  generateToken,
  
  // 随机数
  secureRandom,
  generateOTP,
  generateApiKey,
  
  // 验证
  isValidId,
  isValidNodeId,
  isValidAssetId,
  
  // 加密
  encrypt,
  decrypt,
  generateKeyPair,
  sign,
  verify,
  
  // 常量
  ID_PREFIXES
};
