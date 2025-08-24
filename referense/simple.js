// ==UserScript==
// @name        Nachoneko表情包
// @namespace   Nachoneko
// @description 在 LINUX.DO 插入甘城猫猫表情包
// @match       https://linux.do/t/topic/*
// @origin      SMNET Studio
// @author      Nachoneko
// @version     1.3
// @grant       none
// ==/UserScript==

;(function () {
  'use strict'

  // 修改后的 CSS，类名已更改
  var styles = `
    .nacho-emoji-picker {
      position: static;
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 10px;
      max-height: 300px;
      overflow: auto;
      background-color: #f8f8f8;
      padding: 10px;
      border-radius: 5px;
      z-index: 9999;
    }
    .nacho-emoji-picker img {
      cursor: pointer;
      width: 95px;
      height: 100px;
    }
    `
  var styleSheet = document.createElement('style')
  styleSheet.type = 'text/css'
  styleSheet.innerText = styles
  document.head.appendChild(styleSheet)

  const emojiSet = [
    {
      packet: 1,
      name: '瞌睡',
      url: 'https://linux.do/uploads/default/optimized/4X/5/9/f/59ffbc2c53dd2a07dc30d4368bd5c9e01ca57d80_2_490x500.jpeg'
    },
    {
      packet: 2,
      name: '哭泣',
      url: 'https://linux.do/uploads/default/optimized/4X/5/d/9/5d932c05a642396335f632a370bd8d45463cf2e2_2_503x500.jpeg'
    },
    {
      packet: 3,
      name: '疑问',
      url: 'https://linux.do/uploads/default/optimized/4X/f/a/a/faa5afe1749312bc4a326feff0eca6fb39355300_2_518x499.jpeg'
    },
    {
      packet: 4,
      name: '干嘛',
      url: 'https://linux.do/uploads/default/optimized/4X/5/5/2/552f13479e7bff2ce047d11ad821da4963c467f2_2_500x500.jpeg'
    },
    {
      packet: 5,
      name: '吃东西',
      url: 'https://linux.do/uploads/default/optimized/4X/0/d/1/0d125de02c201128bf6a3f78ff9450e48a3e27de_2_532x500.jpeg'
    },
    {
      packet: 6,
      name: '是我',
      url: 'https://linux.do/uploads/default/optimized/4X/2/3/f/23fac94d8858a23cbd49879f2b037a2be020c87e_2_500x500.jpeg'
    },
    {
      packet: 7,
      name: '玩吗',
      url: 'https://linux.do/uploads/default/optimized/4X/3/1/a/31a38450e22d42f9d4b683b190a40b9a94727681_2_493x500.jpeg'
    },
    {
      packet: 8,
      name: '嘻嘻',
      url: 'https://linux.do/uploads/default/optimized/4X/6/a/3/6a3619da1dbb63cc0420fbf1f6f2316b5503ab09_2_413x500.jpeg'
    },
    {
      packet: 9,
      name: '洗澡',
      url: 'https://linux.do/uploads/default/optimized/4X/e/1/4/e1429fd845288aa4c75e30829efe4696a1f4b1f9_2_636x500.jpeg'
    },
    {
      packet: 11,
      name: '困了',
      url: 'https://linux.do/uploads/default/optimized/4X/7/f/4/7f4d50105aefec0efa80c498179a7d0901b54a7a_2_564x500.jpeg'
    },
    {
      packet: 12,
      name: '我汗',
      url: 'https://linux.do/uploads/default/optimized/4X/8/a/b/8ab3b1fb6c7d990c9070e010f915fb237093f67f_2_490x500.jpeg'
    },
    {
      packet: 13,
      name: '哇哦',
      url: 'https://linux.do/uploads/default/optimized/4X/2/9/c/29ce5a00273ba10ae9c1a8abf7a3b42abcccdd66_2_533x499.jpeg'
    },
    {
      packet: 14,
      name: '无聊',
      url: 'https://linux.do/uploads/default/optimized/4X/1/0/6/1063e1803fa965cd1604bda0e6d7705376f9963f_2_500x500.jpeg'
    },
    {
      packet: 15,
      name: '盯着',
      url: 'https://linux.do/uploads/default/optimized/4X/6/e/6/6e68786e64c4260746d02d2e308168b200185d7d_2_613x500.jpeg'
    },
    {
      packet: 16,
      name: 'ok',
      url: 'https://linux.do/uploads/default/optimized/4X/1/a/b/1ab685b8f2948689a917aa1c0d7ce9bfa2ec48bd_2_594x500.jpeg'
    },
    {
      packet: 17,
      name: '沉默',
      url: 'https://linux.do/uploads/default/optimized/4X/1/c/3/1c39b615e9ef831568ede182ecdec0e749bbd202_2_503x499.jpeg'
    },
    {
      packet: 18,
      name: '开心',
      url: 'https://linux.do/uploads/default/optimized/4X/6/5/0/650110fc5845e915cf4aefec11e4a058f4aff731_2_500x500.png'
    },
    {
      packet: 19,
      name: '睡觉',
      url: 'https://linux.do/uploads/default/optimized/4X/9/0/9/90957308d24a9c79257425ff0f8a14411b6aaad6_2_500x500.png'
    },
    {
      packet: 20,
      name: '生气',
      url: 'https://linux.do/uploads/default/optimized/4X/8/1/9/81909951f915b3e969c93d433b9fd6935a431d9a_2_500x500.png'
    },
    {
      packet: 21,
      name: '抱抱',
      url: 'https://linux.do/uploads/default/optimized/4X/2/5/6/256411726c9680d821da26ad699e7d2d574ab24c_2_500x500.png'
    },
    {
      packet: 22,
      name: '花痴',
      url: 'https://linux.do/uploads/default/optimized/4X/1/e/a/1eaf593a62462e72a4193f6c646f51898e85f53d_2_500x500.png'
    },
    {
      packet: 23,
      name: '彩色',
      url: 'https://linux.do/uploads/default/optimized/4X/5/7/b/57b21409decd4258dc93ce93cff40ef3b631de46_2_500x500.png'
    },
    {
      packet: 24,
      name: '惊讶',
      url: 'https://linux.do/uploads/default/optimized/4X/9/8/9/989df0f7b3b9683974162f491a517305711e28ce_2_500x500.png'
    },
    {
      packet: 25,
      name: '真诚',
      url: 'https://linux.do/uploads/default/optimized/4X/b/8/5/b85433e17a79846cf2ec8a9458506ce6f48d25b2_2_500x500.png'
    },
    {
      packet: 26,
      name: '流口水',
      url: 'https://linux.do/uploads/default/optimized/4X/3/9/9/399d86225dadc703fabb1a8df48be5b36908320c_2_488x500.png'
    },
    {
      packet: 27,
      name: '尴尬',
      url: 'https://linux.do/uploads/default/original/4X/1/d/5/1d58ac97d5e63b36083a5eadb67a3f3404f0b063.png',
      width: 512,
      height: 493
    },
    {
      packet: 28,
      name: '是的',
      url: 'https://linux.do/uploads/default/original/4X/c/3/b/c3bcb5be07dd54b84038568d6ae9762afb86c8f9.png',
      width: 512,
      height: 481
    },
    {
      packet: 29,
      name: 'nya',
      url: 'https://linux.do/uploads/default/original/4X/8/f/e/8fe82a64472dc96eaf9b27dc86f0655fee325572.png',
      width: 512,
      height: 477
    },
    {
      packet: 30,
      name: '脸红',
      url: 'https://linux.do/uploads/default/optimized/4X/3/f/6/3f6c5ed37cb8a5b4c06d1c9b1e8aab38ddfe9878_2_500x500.png'
    },
    {
      packet: 31,
      name: '大哭',
      url: 'https://linux.do/uploads/default/optimized/4X/8/2/2/8220d4c92b848b15d642dd22973bd0854d734aa9_2_500x500.png'
    },
    {
      packet: 32,
      name: 'hi',
      url: 'https://linux.do/uploads/default/optimized/4X/f/2/2/f228b317d9c333833ccf3a81fee705024a548963_2_500x500.png'
    },
    {
      packet: 33,
      name: '爱心',
      url: 'https://linux.do/uploads/default/optimized/4X/f/9/9/f99df315a1cdba0897bc6f4776ebdcc360ddf562_2_500x500.png'
    },
    {
      packet: 34,
      name: '眼罩',
      url: 'https://linux.do/uploads/default/optimized/4X/a/e/5/ae56ca1c5ee8ab2c47104c54077efcedbbdc474e_2_500x500.png'
    },
    {
      packet: 35,
      name: '委屈',
      url: 'https://linux.do/uploads/default/optimized/4X/e/1/e/e1e37eca93601022f3efcd91cb477b88ee350e07_2_500x500.png'
    },
    {
      packet: 36,
      name: '害羞',
      url: 'https://linux.do/uploads/default/optimized/4X/7/8/0/78015ed5ccdc87e5769eb2d1af5cdaf466c1cb07_2_500x500.png'
    },
    {
      packet: 37,
      name: '打哈欠',
      url: 'https://linux.do/uploads/default/optimized/4X/2/f/4/2f453be9d3d69d459637f3cd824b6f9641b6f592_2_500x500.png'
    },
    {
      packet: 38,
      name: '红温',
      url: 'https://linux.do/uploads/default/optimized/4X/2/4/c/24cac75d64461ba1d1b0c3c8560a1c10acb3f3ad_2_500x500.png'
    },
    {
      packet: 39,
      name: '愤怒',
      url: 'https://linux.do/uploads/default/optimized/4X/3/d/2/3d245f6de7d3549174cef112560dec8ae3a768d7_2_500x500.png'
    },
    {
      packet: 40,
      name: '猫猫の福利',
      url: 'https://linux.do/uploads/default/optimized/4X/c/0/b/c0bb1d42d12ef192657896abccf05d97c6298bdd_2_500x500.jpeg'
    }
  ]

  const isMobileDevice = () => {
    return /Mobi|Android|iPhone|iPad|iPod|Windows Phone/i.test(navigator.userAgent)
  }

  const isMiniReply = () => {
    const replyEle = document.querySelector('#reply-control')
    if (replyEle.className.includes('hide-preview') && window.innerWidth < 1600) {
      return true
    }
    return false
  }

  setInterval(() => {
    var toolbar = document.querySelector('.d-editor-button-bar[role="toolbar"]')
    if (toolbar && !document.querySelector('.nacho-emoji-picker-button')) {
      var emojiButton = document.createElement('button')
      emojiButton.classList.add(
        'btn',
        'no-text',
        'btn-icon',
        'toolbar__button',
        'nacho-emoji-picker-button'
      )
      emojiButton.title = 'Nachoneko表情包'
      emojiButton.type = 'button'
      emojiButton.innerHTML = `🐈‍⬛`
      toolbar.appendChild(emojiButton)

      emojiButton.addEventListener('click', function (event) {
        event.stopPropagation()

        let existingPicker = document.querySelector('.nacho-emoji-picker')
        if (existingPicker) {
          existingPicker.remove()
          document.removeEventListener('click', handleClickOutside)
          return
        }

        var emojiPicker = document.createElement('div')
        emojiPicker.className = 'nacho-emoji-picker'
        emojiPicker.innerHTML = emojiSet
          .map(
            emo =>
              `<img src="${emo.url}" alt="${emo.name}" title="${emo.name}" data-width="${emo.width}" data-height="${emo.height}"/>`
          )
          .join('')

        document.body.appendChild(emojiPicker)

        var buttonRect = emojiButton.getBoundingClientRect()
        if (isMobileDevice()) {
          let replyRect = document.querySelector('#reply-control').getBoundingClientRect()
          emojiPicker.style.position = 'fixed'
          emojiPicker.style.bottom = replyRect.top - 5 + 'px'
          emojiPicker.style.left = replyRect.left + 'px'

          let imagePanel = document.querySelector('.nacho-emoji-picker img')
          imagePanel.style.width = '80px'
          imagePanel.style.height = '85px'
        } else {
          if (isMiniReply()) {
            let editorRect = document
              .querySelector('.d-editor-textarea-wrapper')
              .getBoundingClientRect()
            emojiPicker.style.position = 'fixed'
            emojiPicker.style.top = editorRect.top + 'px'
            emojiPicker.style.left =
              editorRect.left + editorRect.width / 2 - emojiPicker.clientWidth / 2 + 'px'
          } else {
            let editorRect = document
              .querySelector('.d-editor-textarea-wrapper')
              .getBoundingClientRect()
            emojiPicker.style.position = 'fixed'
            emojiPicker.style.top = editorRect.top + 'px'
            emojiPicker.style.left = editorRect.right + 10 + 'px'
          }
        }

        function handleClickOutside(e) {
          if (emojiPicker && !emojiPicker.contains(e.target)) {
            emojiPicker.remove()
            document.removeEventListener('click', handleClickOutside)
          }
        }

        setTimeout(() => {
          document.addEventListener('click', handleClickOutside)
        }, 0)

        emojiPicker.addEventListener('click', function (e) {
          if (e.target.tagName === 'IMG') {
            var textArea = document.querySelector('textarea.d-editor-input')
            var richEle = document.querySelector('.ProseMirror.d-editor-input')
            if (!textArea && !richEle) {
              console.error('找不到输入框')
              return
            }

            const match = e.target.src.match(/_(\d{3,})x(\d{3,})\./)
            let width = '500'
            let height = '500'
            if (match) {
              width = match[1]
              height = match[2]
            } else {
              if (e.target.getAttribute('data-width') && e.target.getAttribute('data-height')) {
                width = e.target.getAttribute('data-width')
                height = e.target.getAttribute('data-height')
              }
            }

            if (textArea) {
              var emojiMarkdown = `![${e.target.alt}|${width}x${height},30%](${e.target.src}) `

              var startPos = textArea.selectionStart
              var endPos = textArea.selectionEnd
              textArea.value =
                textArea.value.substring(0, startPos) +
                emojiMarkdown +
                textArea.value.substring(endPos, textArea.value.length)

              textArea.selectionStart = textArea.selectionEnd = startPos + emojiMarkdown.length
              textArea.focus()

              var event = new Event('input', {
                bubbles: true,
                cancelable: true
              })
              textArea.dispatchEvent(event)
            } else {
              if (richEle) {
                var imgTemplate = `<img src="${e.target.src}" alt="${e.target.alt}" width="${width}" height="${height}" data-scale="30" style="width: ${Math.round(width * 0.3)}px">`
                try {
                  var dt = new DataTransfer()
                  dt.setData('text/html', imgTemplate)
                  var evt = new ClipboardEvent('paste', { clipboardData: dt, bubbles: true })
                  richEle.dispatchEvent(evt)
                } catch (_) {
                  try {
                    document.execCommand('insertHTML', false, imgTemplate)
                  } catch (e) {
                    console.error('无法向富文本编辑器中插入表情', e)
                  }
                }
              }
            }

            if (emojiPicker) {
              emojiPicker.remove()
            }
            document.removeEventListener('click', handleClickOutside)
          }
        })
      })
    }
  }, 500)
})()
