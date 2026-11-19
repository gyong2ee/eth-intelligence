#!/usr/bin/env python3
"""Update daily gross staking flows from CryptoKeyhole's public HTML table."""
import json, re, urllib.request
from pathlib import Path
from datetime import datetime
from html import unescape
from html.parser import HTMLParser

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'data/staking-history.json'
URL='https://cryptokeyhole.com/ethereum-staking/'
class TableParser(HTMLParser):
    def __init__(self):
        super().__init__();self.tables=[];self.table=None;self.row=None;self.cell=None
    def handle_starttag(self,tag,attrs):
        if tag=='table':self.table=[]
        elif self.table is not None and tag=='tr':self.row=[]
        elif self.row is not None and tag in ('td','th'):self.cell=[]
    def handle_data(self,data):
        if self.cell is not None:self.cell.append(data)
    def handle_endtag(self,tag):
        if tag in ('td','th') and self.cell is not None:self.row.append(' '.join(self.cell).strip());self.cell=None
        elif tag=='tr' and self.row is not None:self.table.append(self.row);self.row=None
        elif tag=='table' and self.table is not None:self.tables.append(self.table);self.table=None
def num(s):return float(re.sub(r'[^0-9.\-]','',s.replace('−','-').replace(',','')))
def main():
    req=urllib.request.Request(URL,headers={'User-Agent':'Mozilla/5.0 (compatible; ETHStakingHistory/1.0)'})
    with urllib.request.urlopen(req,timeout=25) as resp: html=resp.read().decode('utf-8')
    parser=TableParser();parser.feed(html)
    records=[]
    for table in parser.tables:
        if not table or not ('Principal withdrawn' in ' '.join(table[0]) and 'New validators' in ' '.join(table[0])):continue
        for row in table[1:]:
            if len(row)<5:continue
            try:
                date=datetime.strptime(row[0].strip(),'%d %b %Y').strftime('%Y-%m-%d')
                dep,wd,net=num(row[1]),num(row[3]),num(row[4])
                if dep<0 or wd<0 or abs(dep-wd-net)>2:continue
                records.append(dict(date=date,deposits=dep,withdrawals=wd,net=net,finality='final'))
            except (ValueError,IndexError):continue
    if len(records)<7:raise RuntimeError('Fewer than 7 valid daily rows; refusing to overwrite historical dataset')
    old=json.loads(OUT.read_text()) if OUT.exists() else []
    by_date={p['date']:p for p in old}
    for row in records:
        # Published HTML table rounds to whole ETH; retain high precision CSV values for existing dates.
        if row['date'] not in by_date:by_date[row['date']]=row
    # Today's partial record is not final: don't leave an outdated partial once the closed-day table is available.
    for row in records:
        if row['date'] in by_date and by_date[row['date']].get('finality')=='partial':
            by_date[row['date']]=row
    merged=sorted(by_date.values(),key=lambda x:x['date'])
    OUT.parent.mkdir(parents=True,exist_ok=True)
    OUT.write_text(json.dumps(merged,ensure_ascii=False,separators=(',',':'))+'\n')
    print('Parsed',len(records),'closed days; stored',len(merged),'historical days; latest',merged[-1]['date'])
if __name__=='__main__':main()
