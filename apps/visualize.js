import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { listRoleImages } from '../model/galleryIndex.js'
import { resolveRoleName } from '../modules/alias.js'
import { render } from '../components/render.js'
import { formatSize, getDirSize } from '../components/format.js'
import { guardLayout } from '../model/layoutGuard.js'

/** 
 * 可视化命令：
 * 1. #角色面板图可视化（兼容框架归一后的 `#星铁` 前缀）
 * 2. #可视化角色（新增支持，兼容 `#星铁` 前缀）
 */
const VISUALIZE_RE = /^#?\s*(?:星铁)?\s*(?:可视化\s*(.+?)|(.+?)\s*面板图可视化)\s*$/

/** 每页展示的图片数（4 列网格 × 5 行） */
const PAGE_SIZE = 20

/**
 * #角色名面板图可视化 — HTML 网格浏览角色全部面板图（多图库源）
 */
export class Visualize extends plugin {
  constructor() {
    super({
      name: '[面板图图库管理器]面板图可视化',
      dsc: 'HTML 可视化浏览面板图',
      event: 'message',
      // � 修改为 1，避开负数兼容性BUG，同时稳稳碾压 Atlas 的 20000 优先级
      priority: 1,
      rule: [
        { reg: VISUALIZE_RE, fnc: 'visualize' }
      ]
    })
  }

  async visualize (e) {
    if (!(await guardLayout(e))) return true

    const match = e.msg.match(VISUALIZE_RE)
    if (!match) return true

    // 按优先级从捕获组中提取角色名
    const rawName = match[1] || match[2] || ''
    const roleName = resolveRoleName(rawName.trim())

    if (!roleName) {
      return e.reply('[面板图图库管理器]\n请输入正确的角色名')
    }

    const files = listRoleImages(roleName, 'normal')
    if (files.length === 0) {
      return e.reply(`[面板图图库管理器]\n角色「${roleName}」暂无面板图`)
    }

    let folderSize = ''
    try {
      const dirs = [...new Set(files.map(f => f.dir))]
      let total = 0
      for (const dir of dirs) total += getDirSize(dir)
      folderSize = formatSize(total)
    } catch { /* 目录不可读时不显示 */ }

    const totalPages = Math.ceil(files.length / PAGE_SIZE)

    try {
      for (let p = 0; p < totalPages; p++) {
        const pageFiles = files.slice(p * PAGE_SIZE, (p + 1) * PAGE_SIZE)
        const images = pageFiles.map((f) => {
          const base = f.name.replace(/\.[^.]+$/, '')
          return {
            fileName: f.displayN !== null ? `${f.displayN}. ${base}` : `[${f.label}] ${base}`,
            fileUrl: pathToFileURL(f.filePath).href
          }
        })

        const data = {
          roleName,
          totalCount: files.length,
          page: p + 1,
          totalPages,
          folderSize,
          images
        }

        const img = await render('visualize', 'index', data, 'jpeg')
        if (!img) {
          return e.reply('[面板图图库管理器] 可视化图生成失败，请重试。')
        }
        await e.reply(img)
      }
    } catch (err) {
      logger.error('[ProfileImg-Plugin] 可视化失败:', err)
      return e.reply('[面板图图库管理器] 可视化失败: ' + err.message)
    }
    return true
  }
}
