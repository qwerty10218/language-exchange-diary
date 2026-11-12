import settings from '../data/writing-settings.json' with { type: 'json' };
import { GUIDE_DEFAULTS, guideOptions } from './stroke-engine.mjs';

export const WRITING_SETTINGS = settings;
export function strokeOptions(character, index, config = settings) {
  const types = character.strokeTypes?.[index] ?? [];
  return {
    ...GUIDE_DEFAULTS, ...guideOptions(character.id,index), ...config.global,
    ...Object.assign({}, ...types.map(type => config.types[type] ?? {})),
    ...(config.overrides[character.id]?.strokes?.[index] ?? {}),
  };
}
export function validateSettings(config) {
  const errors=[];
  if (!config || config.version!==1 || !config.global || !config.types || !config.overrides) return ['設定結構無效'];
  const bounds={startRadius:[.05,.25],snapRadius:[.05,.25],maxDeviation:[.1,.35],completion:[.75,1],closeRatio:[.6,1],autoTriggerDistance:[.02,.1],animationMs:[500,4000],acceptanceMs:[200,1000],maxSearchFraction:[.02,.25]};
  const check = (obj, label, partial=false) => {
    for(const [key,value] of Object.entries(obj)) {
      if(bounds[key] && (typeof value!=='number' || !Number.isFinite(value) || value<bounds[key][0] || value>bounds[key][1])) errors.push(`${label}.${key} 超出範圍`);
      else if(!bounds[key] && !['showGuides','strictOrder','rejectBackwards'].includes(key)) errors.push(`${label}.${key} 不支援`);
    }
    if(!partial) for(const key of Object.keys(settings.global)) if(!(key in obj)) errors.push(`${label}.${key} 缺少`);
    for(const key of ['strictOrder','rejectBackwards']) if((!partial || key in obj) && obj[key]!==true) errors.push(`${label}.${key} 必須維持開啟`);
    if('showGuides' in obj && typeof obj.showGuides!=='boolean') errors.push(`${label}.showGuides 無效`);
    if('snapRadius' in obj && 'maxDeviation' in obj && obj.snapRadius>obj.maxDeviation) errors.push(`${label} 磁吸半徑不可大於偏離容忍`);
  };
  check(config.global,'global');
  for(const [type,value] of Object.entries(config.types)) {
    if(!['straight','curve','short','crossing'].includes(type)) errors.push(`未知筆畫類型 ${type}`);
    check(value,`types.${type}`,true);
  }
  for(const [id,value] of Object.entries(config.overrides)) {
    if(!value.reason?.trim() || !value.strokes) { errors.push(`${id} 覆寫須註明原因及筆畫`); continue; }
    for(const [i,obj] of Object.entries(value.strokes)) check(obj,`${id}.${i}`,true);
  }
  return errors;
}
