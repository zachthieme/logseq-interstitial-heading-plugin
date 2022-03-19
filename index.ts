import '@logseq/libs';
import SettingSchemaDesc from '@logseq/libs/dist/LSPlugin.user';

var simple = true;

const settingsTemplate:SettingSchemaDesc[] = [{
    key: "defaultTitle",
    type: 'boolean',
    default: false,
    title: "Insert Header by default?",
    description: "If true, \"<mod> t\" will insert a header, otherwise only the time",
   },{
    key: "level",
    type: 'number',
    default: 3,
    title: "Title level?",
    description: "Insert timestamped heading level, default to 3 (### HH:MM title)",
    }
]
logseq.useSettingsSchema(settingsTemplate)

async function updateBlock(block,simple) {
    let content = /^#{1,6}\s+/.test(block.content)
        ? block.content.replace(/^#{1,6}\s+/, '')
        : block.content;
    var today = new Date();
    let time = today.getHours() + ":" + String(today.getMinutes()).padStart(2, '0')
    let timestamp = simple ? ' ' + time + ' ' : '**' + time + '** '
    let header = simple ? '#'.repeat(logseq.settings.level) : ''
    await logseq.Editor.updateBlock(
            block.uuid,
            header + timestamp + content
            );
}

async function insertInterstitional(simple) {
  const selected = await logseq.Editor.getSelectedBlocks();
  if (selected && selected.length > 1) {
    for (let block of selected) {
        updateBlock(block, simple)
         }
  } else {
    const block = await logseq.Editor.getCurrentBlock();
    if (block?.uuid) {
        updateBlock(block, simple)
    }
  }
}

async function parseQuery(randomQuery:boolean,queryTag:string){
  // https://stackoverflow.com/questions/19156148/i-want-to-remove-double-quotes-from-a-string
  const queryRandom = `[:find (pull ?b [*])
  :where
  [?b :block/path-refs [:block/name "${queryTag.toLowerCase().trim().replace(/^["'](.+(?=["']$))["']$/, '$1')}"]]]`
  const queryDaily = `[:find (pull ?b [*])
  :where
  [?b :block/path-refs [:block/name "${queryTag.toLowerCase().trim().replace(/^["'](.+(?=["']$))["']$/, '$1')}"]]]
  [?p :block/journal?]
  [?p :block/journal-day ?yest]
  ]
  :inputs [:yesterday]`
  let query = ( randomQuery ) ? queryRandom : queryDaily
  // console.log("q",query)
  try { 
    let results = await logseq.DB.datascriptQuery(query) 
    console.log("res",results)
    //Let this be, it won't hurt even if there's only one hit
    let flattenedResults = results.map((mappedQuery) => ({
      uuid: mappedQuery[0].uuid['$uuid$'],
    }))
    let index = Math.floor(Math.random()*flattenedResults.length)
    const origBlock = await logseq.Editor.getBlock(flattenedResults[index].uuid, {
      includeChildren: true,
    });
    return `((${flattenedResults[index].uuid}))`
  } catch (error) {return `Sorry, an interstial error wiggled in your life (severely lacking ${queryTag})`}
}

async function checkParent(uuid){
  try {
    console.log("6. checkParent uuid:",uuid)
    const block = await logseq.Editor.getBlock(uuid, { includeChildren: true})
    if (block) {
      console.log("7. block",block)

      if (block.properties) {
        if (block.properties.template != undefined) {
          //it's a template
          console.log("8. template: block true props",block.properties)
          return true
        } 
        else {
          if (block.parent != null && block.parent.id !== block.page.id) {
              console.log("9. loop", block.parent)
              checkParent(block.parent.id)
          }
          else {
            //it's not a template
            console.log("10. def not a template",block)
            return false
          }
        }
      } 
      else {
            //it's not a template
            console.log("11. def not a template (no properties)",block)
            return false
      }
    }      
  } catch (error) { console.log(error) }
}

async function main() {

    logseq.App.onMacroRendererSlotted(async ({ slot, payload }) => {
      var [type, randomQ , tagQ ] = payload.arguments
      if (type !== ':interstitial') return
      const block = parseQuery(randomQ,tagQ)

      console.log("1. Running onMacroRendererSlotted",payload)
      //is the block in a template?
      if (checkParent(payload.uuid)) { 
        console.log("2. Discarding edit")
        logseq.provideUI({
          key: "luckysheet",
          slot,
          template: `REPLACEMENT`,
          reset: true,
          style: { flex: 1 },
        })
        return }
      else {
        console.log("3. Replacing block")
        // const block = await parseQuery(randomQ,tagQ)
        console.log("4. block updated")
        logseq.Editor.updateBlock(payload.uuid, block)
        console.log("5. edited")
      }
    })

    logseq.App.registerCommandPalette(
      {
        key: `interstial-time-stamp`,
        label: `Insert interstitial line`,
        keybinding: {
          mode: 'global',
          binding: 'mod+t',
        },
      },
      async () => {
        await insertInterstitional(logseq.settings.defaultTitle ? true : false);
      }
    );

    logseq.App.registerCommandPalette(
      {
        key: `interstial-time-stamp-h`,
        label: `Insert interstitial heading`,
        keybinding: {
          mode: 'global',
          binding: 'mod+shift+t',
        },
      },
      async () => {
        await insertInterstitional(logseq.settings.defaultTitle ? false : true);
      }
    );
}

logseq.ready(main).catch(console.error);
