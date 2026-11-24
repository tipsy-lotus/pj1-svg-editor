const { test } = require('node:test');
const assert = require('node:assert/strict');
const { SvgOutlineParser } = require('../dist/SvgOutlineParser.js');

test('包含 SVG 根、嵌套分组、无 id 元素和 CLI 未支持的元素', () => {
  const source = '<svg><g id="flow"><rect id="start"/><text>开始</text><g><path d="M0 0"/></g></g></svg>';
  const [root] = new SvgOutlineParser().parse(source);
  assert.equal(root.name, 'svg');
  const [group] = root.children;
  assert.equal(group.name, 'g#flow');
  assert.deepEqual(group.children.map(child => child.name), ['rect#start', 'text', 'g']);
  assert.equal(group.children[2].children[0].name, 'path');
  assert.equal(root.end, source.length);
});

test('中文、emoji、CRLF、注释、引号内的大于号不会破坏源码位置', () => {
  const source = '<?xml version="1.0"?>\r\n<svg><!-- <g/> --><text>中文😀</text>\r\n  <rect id="目标" data-note="a>b"/>\r\n</svg>';
  const [root] = new SvgOutlineParser().parse(source);
  const rect = root.children[1];
  assert.equal(source.slice(rect.start, rect.end), '<rect id="目标" data-note="a>b"/>');
  assert.equal(source.slice(rect.selectionStart, rect.selectionEnd), 'rect');
  assert.equal(rect.start, source.indexOf('<rect'));
  assert.equal(root.children.length, 2);
});

test('重复解析使用新内容，没有旧树残留', () => {
  const parser = new SvgOutlineParser();
  assert.equal(parser.parse('<svg><g id="old"/></svg>')[0].children[0].name, 'g#old');
  assert.equal(parser.parse('<svg><circle id="new"/></svg>')[0].children[0].name, 'circle#new');
});

test('不完整或不匹配 XML 清空大纲，后续修复后可以继续解析', () => {
  const parser = new SvgOutlineParser();
  for (const source of ['', '<svg>', '<svg><g', '<svg><g></svg>', '<svg/><svg/>', '<html/>', '<svg><text>&missing;</text></svg>']) {
    assert.deepEqual(parser.parse(source), [], source);
  }
  assert.equal(parser.parse('<svg/>')[0].name, 'svg');
});

test('CDATA 不产生伪节点，id 实体正确解码', () => {
  const [root] = new SvgOutlineParser().parse('<svg><text id="a&amp;b"><![CDATA[<rect/>]]></text></svg>');
  assert.equal(root.children[0].name, 'text#a&b');
  assert.equal(root.children[0].children.length, 0);
});
