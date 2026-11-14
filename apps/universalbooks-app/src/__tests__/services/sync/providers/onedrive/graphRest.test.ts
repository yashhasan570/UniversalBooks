// @vitest-environment node
import { describe, expect, test } from 'vitest';
import {
  childrenUrl,
  contentUrl,
  deleteItemUrl,
  encodeGraphPath,
  itemUrl,
  meUrl,
  uploadSessionUrl,
} from '@/services/sync/providers/onedrive/graphRest';

const APPROOT = 'https://graph.microsoft.com/v1.0/me/drive/special/approot';

describe('graphRest', () => {
  test('encodeGraphPath strips slashes and encodes each segment', () => {
    expect(encodeGraphPath('/Universal Books/books/a b/config.json')).toBe(
      'Universal Books/books/a%20b/config.json',
    );
    expect(encodeGraphPath('/')).toBe('');
  });

  test('itemUrl addresses by path with a $select', () => {
    expect(itemUrl('/Universal Books/x.json', 'size,cTag,file')).toBe(
      `${APPROOT}:/Universal Books/x.json?$select=size,cTag,file`,
    );
  });

  test('contentUrl targets the content endpoint', () => {
    expect(contentUrl('/Universal Books/x.json')).toBe(`${APPROOT}:/Universal Books/x.json:/content`);
  });

  test('childrenUrl of a nested path uses the colon form; root uses no colon', () => {
    expect(childrenUrl('/Universal Books/books')).toBe(
      `${APPROOT}:/Universal Books/books:/children?$select=name,size,cTag,file,folder&$top=200`,
    );
    expect(childrenUrl('/')).toBe(
      `${APPROOT}/children?$select=name,size,cTag,file,folder&$top=200`,
    );
  });

  test('deleteItemUrl + uploadSessionUrl + meUrl', () => {
    expect(deleteItemUrl('/Universal Books/x')).toBe(`${APPROOT}:/Universal Books/x`);
    expect(uploadSessionUrl('/Universal Books/b.epub')).toBe(
      `${APPROOT}:/Universal Books/b.epub:/createUploadSession`,
    );
    expect(meUrl()).toBe(
      'https://graph.microsoft.com/v1.0/me?$select=userPrincipalName,mail,displayName',
    );
  });
});
