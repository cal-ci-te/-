// 用户输入长度校验。防止超长字符串导致数据库写入缓慢、前端渲染溢出或存储膨胀。
// 所有写入 API 在数据库操作之前统一调用此模块。
const LIMITS = {
  title:    { min: 1, max: 200,   label: '标题' },
  content:  { min: 0, max: 100000, label: '内容' },
  category: { min: 1, max: 50,    label: '分类' },
  name:     { min: 1, max: 50,    label: '贴图名称' },
};

function validate(fields) {
  for (const [fieldName, value] of Object.entries(fields)) {
    const limit = LIMITS[fieldName];
    if (!limit) continue;
    if (typeof value !== 'string') {
      return { field: fieldName, error: `${limit.label}必须为字符串` };
    }
    if (value.length < limit.min) {
      return { field: fieldName, error: `${limit.label}不能为空` };
    }
    if (value.length > limit.max) {
      return { field: fieldName, error: `${limit.label}不能超过${limit.max}字符（当前${value.length}字符）` };
    }
  }
  return null;
}

module.exports = { validate, LIMITS };
