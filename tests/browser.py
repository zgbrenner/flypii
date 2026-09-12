"""Browser verification against the exact production graph. Fixture mode is explicit."""
import json, os, shutil, subprocess, tempfile, time, traceback, urllib.request
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'reports'
FIXTURE=os.environ.get('FLYPII_TEST_FIXTURE')=='1'
BASE='http://127.0.0.1:4173'
URL=BASE+('/?fixture=1' if FIXTURE else '/')
checks=[]; errors=[]; requests=[]
report={'fixture':FIXTURE,'url':URL,'checks':checks,'consoleErrors':errors,'method':'Playwright Chromium; Browser plugin not available','testedCommit':os.environ.get('GITHUB_SHA')}
def check(name, condition=True, **detail):
    if not condition: raise AssertionError(name+': '+json.dumps(detail))
    checks.append({'name':name,'passed':True,**detail}); print('PASS '+name,flush=True)
def snap(page): return page.evaluate('() => window.__flypii.snapshot')
def wait(page, expression, timeout=900000):
    # wait_for_function uses in-page eval on this Playwright version, which our
    # production CSP correctly rejects. Poll via the automation evaluator instead;
    # do not add unsafe-eval or bypass_csp to the app or browser context.
    deadline=time.monotonic()+timeout/1000
    while time.monotonic()<deadline:
        if page.evaluate('() => Boolean('+expression+')'): return
        page.wait_for_timeout(75)
    page.screenshot(path=str(OUT/'wait-timeout.png'),full_page=True)
    raise TimeoutError('Condition not met: '+expression+'; status='+page.locator('#status').inner_text())
def idle(page): wait(page,'window.__flypii && !window.__flypii.snapshot.busy')
def analyze(page,text):
    page.locator('#text').fill(text); page.locator('#analyze').click(); idle(page)
    expect(page.locator('#result')).to_be_visible(); return snap(page)
def screenshot(page,name):
    page.screenshot(path=str(OUT/(name+'.png')),full_page=True,animations='disabled')
    page.screenshot(path=str(OUT/(name+'.jpg')),type='jpeg',quality=58,animations='disabled')
def run():
    OUT.mkdir(exist_ok=True); reference=json.loads((OUT/'full-benchmark.json').read_text())
    log=open(OUT/'browser-server.log','w')
    server=subprocess.Popen(['node','scripts/serve.mjs'],cwd=ROOT,env=dict(os.environ,SERVE_DIR=str(ROOT/'dist')),stdout=log,stderr=log)
    start=time.monotonic()
    try:
        for _ in range(100):
            if server.poll() is not None: raise RuntimeError('Server exited: '+(OUT/'browser-server.log').read_text())
            try: urllib.request.urlopen(BASE,timeout=1).close(); break
            except OSError: time.sleep(.1)
        with sync_playwright() as p:
            browser=p.chromium.launch(headless=True,executable_path=os.environ.get('CHROMIUM_PATH') or shutil.which('chromium'),args=['--no-sandbox','--disable-dev-shm-usage'])
            report['browser']=browser.version
            ctx=browser.new_context(viewport={'width':1440,'height':1050},device_scale_factor=1,reduced_motion='reduce',accept_downloads=True)
            ctx.on('request',lambda r:requests.append({'url':r.url,'method':r.method}))
            page=ctx.new_page(); page.on('pageerror',lambda e:errors.append(str(e)))
            page.on('console',lambda m:errors.append(m.text) if m.type=='error' else None)
            page.goto(URL)
            wait(page,'window.__flypii?.snapshot.ready || !document.querySelector("#error").hidden',timeout=180000)
            check('graph and starter model load',snap(page)['ready'],error=page.locator('#error').inner_text())
            state=snap(page); report['graph']=state
            check('correct page identity','FlyPII' in page.title() and page.url==URL)
            check('primary screen is not blank',page.locator('h1').inner_text()=='Whole brain.\nSensitive data.')
            check('production graph is complete',FIXTURE or (state['neurons']==139255 and state['edges']==15091983),neurons=state['neurons'],edges=state['edges'])
            check('graph SHA matches independent Node run',state['graphSha']==reference['graphSha'])
            wait(page,'window.__flypii.snapshot.benchmarkCount === 320',timeout=30000); check('measured starter report loads')
            for case in reference['parityCases']:
                cur=analyze(page,case['text']); delta=max(abs(a-b) for a,b in zip(cur['scores'],case['scores']))
                check('browser/Node numerical parity',delta<1e-5,text=case['text'],maxDelta=delta,latencyMs=cur['latency'])
            cur=analyze(page,reference['parityCases'][0]['text'])
            check('all nodes and edges computed',cur['nodeUpdates']==state['neurons']*6 and cur['edgeUpdates']==state['edges']*6 and cur['finalLength']==state['neurons'] and cur['traceLength']==6,nodeUpdates=cur['nodeUpdates'],edgeVisits=cur['edgeUpdates'])
            check('visualization has a pixel for every neuron',page.locator('#circuit').evaluate('(c)=>c.width*c.height')>=state['neurons'])
            page.locator('#replay').click(); expect(page.locator('#step-label')).to_have_text('MODEL STEP / 06 OF 6')
            before=page.locator('#neuron-detail').inner_text(); page.locator('#circuit').focus(); page.keyboard.press('ArrowRight')
            check('keyboard neuron inspection and reduced-motion replay',before!=page.locator('#neuron-detail').inner_text())
            screenshot(page,'desktop-playground')
            page.locator('#threshold').evaluate('(e)=>{e.value="0.9";e.dispatchEvent(new Event("input",{bubbles:true}));}')
            check('threshold changes verdict',page.locator('#verdict').inner_text()==('PII-like pattern detected' if cur['score']>=.9 else 'No target pattern flagged'))
            page.locator('#threshold').evaluate('(e)=>{e.value="0.5";e.dispatchEvent(new Event("input",{bubbles:true}));}')
            page.locator('#mode').select_option('encoder'); check('mode change clears stale result',page.locator('#result').is_hidden())
            direct=analyze(page,'case7@example.com'); check('encoder mode does not fake neural computation',direct['edgeUpdates']==0 and direct['traceLength']==0 and direct.get('finalLength') is None)
            page.locator('#mode').select_option('fly'); analyze(page,'A harmless phrase.')
            page.locator('#text').fill(''); page.locator('#analyze').click(); check('empty input rejected',page.locator('#error').is_visible() and page.locator('#result').is_hidden())
            page.locator('#text').fill('a'*2001); page.locator('#analyze').click()
            check('oversize input not silently truncated',len(page.locator('#text').input_value())==2001 and 'truncated' in page.locator('#error').inner_text())
            analyze(page,'All good. A watch and a dog.')
            page.locator('#tab-playground').focus(); page.keyboard.press('ArrowRight'); check('keyboard tab navigation',page.locator('#tab-training').get_attribute('aria-selected')=='true')
            page.locator('#training-text').fill('Write to fictional.training@example.org about the telescope.')
            page.locator('input[name=label][value=email]').check(); page.locator('#add-example').click()
            check('custom labeled example added','1 custom' in page.locator('#custom-count').inner_text())
            with tempfile.TemporaryDirectory() as temp:
                temp=Path(temp); example=temp/'custom.jsonl'
                example.write_text(json.dumps({'text':'An ordinary clock is on the shelf.','labels':['none']})+'\n')
                page.locator('#examples-file').set_input_files(str(example)); expect(page.locator('#custom-count')).to_contain_text('2 custom'); check('JSONL import works')
                page.locator('#custom-list button').last.click(); expect(page.locator('#custom-count')).to_contain_text('1 custom')
                page.locator('#count').fill('200'); page.locator('#epochs').fill('2'); original=page.locator('#model-info').inner_text()
                page.locator('#train').click(); wait(page,'window.__flypii.snapshot.busy === "train"'); page.locator('#cancel').click(); idle(page)
                check('cancelled training keeps previous model',page.locator('#model-info').inner_text()==original and 'Cancelled' in page.locator('#status').inner_text())
                page.locator('#train').click(); idle(page)
                check('full browser training completes',not page.locator('#error').is_visible() and snap(page)['customCount']==1 and '2 epochs' in page.locator('#model-info').inner_text())
                check('training invalidates old benchmark',snap(page).get('benchmarkCount') is None)
                with page.expect_download() as info: page.locator('#export-model').click()
                saved=temp/'model.json'; info.value.save_as(str(saved)); exported=json.loads(saved.read_text())
                check('export is bound to graph',exported['graphSha']==state['graphSha'] and exported['customCount']==1)
                check('export omits raw text','fictional.training@example.org' not in saved.read_text())
                screenshot(page,'desktop-training')
                bad=temp/'bad.json'; bad.write_text(json.dumps({'format':'old-209-neuron-model'})); page.locator('#model-file').set_input_files(str(bad)); idle(page); expect(page.locator('#error')).to_be_visible()
                check('incompatible model rejected transactionally',snap(page)['customCount']==1)
                page.locator('#model-file').set_input_files(str(ROOT/'models/starter.json')); idle(page); expect(page.locator('#status')).to_contain_text('Compatible model imported')
                check('full starter model restored',snap(page)['customCount']==0)
                page.locator('#tab-benchmark').click(); page.locator('#run-benchmark').click(); wait(page,'window.__flypii.snapshot.busy === "benchmark"'); page.locator('#cancel').click(); idle(page)
                check('benchmark cancellation safe','Cancelled' in page.locator('#status').inner_text() and snap(page)['customCount']==0)
                page.locator('#run-benchmark').click(); idle(page)
                check('complete browser benchmark on five models',snap(page)['benchmarkCount']==320 and page.locator('#benchmark-rows tr').count()==5)
                with page.expect_download() as info: page.locator('#export-report').click()
                output=temp/'benchmark.json'; info.value.save_as(str(output)); measured=json.loads(output.read_text()); (OUT/'browser-benchmark.json').write_text(json.dumps(measured,indent=2)+'\n')
                check('browser and Node confusion counts match',all(tuple(a[k] for k in ['tp','fp','tn','fn'])==tuple(b[k] for k in ['tp','fp','tn','fn']) for a,b in zip(measured['results'],reference['results'])))
                page.locator('#errors-mode').select_option('encoder'); check('error inspector responds',bool(page.locator('#mistakes').inner_text().strip())); screenshot(page,'desktop-benchmark')
            page.locator('#tab-playground').click(); analyze(page,reference['parityCases'][0]['text']); page.set_viewport_size({'width':390,'height':844})
            check('mobile no horizontal overflow',page.evaluate('document.documentElement.scrollWidth <= innerWidth'))
            mobile=analyze(page,reference['parityCases'][1]['text']); check('mobile-sized full inference',mobile['finalLength']==state['neurons']); screenshot(page,'mobile-playground')
            for name in ['training','benchmark','method']:
                page.locator('#tab-'+name).click(); check('mobile '+name+' has no overflow',page.evaluate('document.documentElement.scrollWidth <= innerWidth'))
            check('noncommercial data terms visible','NonCommercial' in page.locator('#method').inner_text())
            check('text never sent to server',all(r['method']=='GET' and (r['url'].startswith(BASE+'/') or r['url'].startswith('blob:'+BASE+'/') or r['url'].startswith('data:')) for r in requests),requests=len(requests))
            check('no unhandled browser errors',not errors,errors=errors)
            report.update(passed=True,viewports=[{'width':1440,'height':1050},{'width':390,'height':844}],runtimeSeconds=time.monotonic()-start,realDeviceTesting=False)
            browser.close()
    except Exception as e:
        report.update(passed=False,failure=str(e),traceback=traceback.format_exc())
        try: screenshot(page,'failure')
        except Exception: pass
        raise
    finally:
        (OUT/'browser-verification.json').write_text(json.dumps(report,indent=2)+'\n'); server.terminate()
        try: server.wait(timeout=10)
        except subprocess.TimeoutExpired: server.kill()
        log.close()
if __name__=='__main__': run()
