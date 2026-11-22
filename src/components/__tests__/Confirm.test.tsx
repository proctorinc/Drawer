import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ConfirmProvider, useAlert, useConfirm } from '../Confirm';
import type { AlertOptions, ConfirmOptions } from '../Confirm';

let ask: (options: ConfirmOptions) => Promise<boolean>;
let tell: (options: AlertOptions) => Promise<void>;

const Grab = () => {
  ask = useConfirm();
  tell = useAlert();
  return null;
};

function setup() {
  render(
    <ConfirmProvider>
      <Grab />
    </ConfirmProvider>,
  );
}

function open(options: ConfirmOptions) {
  let result!: Promise<boolean>;
  act(() => {
    result = ask(options);
  });
  return result;
}

afterEach(cleanup);

describe('useConfirm', () => {
  it('resolves true when the confirm button is pressed', async () => {
    setup();
    const result = open({
      title: 'delete your comment?',
      message: "it can't be undone.",
      confirmLabel: 'delete',
    });
    expect(screen.getByRole('alertdialog')).toBeTruthy();
    expect(screen.getByText("it can't be undone.")).toBeTruthy();
    fireEvent.click(screen.getByText('delete'));
    await expect(result).resolves.toBe(true);
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('resolves false on cancel, Escape, or a tap outside', async () => {
    setup();
    let result = open({ title: 'sure?', cancelLabel: 'keep it' });
    fireEvent.click(screen.getByText('keep it'));
    await expect(result).resolves.toBe(false);

    result = open({ title: 'sure?' });
    fireEvent.keyDown(document, { key: 'Escape' });
    await expect(result).resolves.toBe(false);

    result = open({ title: 'sure?' });
    const backdrop = screen.getByRole('alertdialog').firstElementChild!;
    fireEvent.click(backdrop);
    await expect(result).resolves.toBe(false);
  });

  it('focuses the safe choice', () => {
    setup();
    void open({ title: 'sure?', cancelLabel: 'keep it' });
    expect(document.activeElement?.textContent).toBe('keep it');
  });

  it('backs out of an open ask when another starts', async () => {
    setup();
    const first = open({ title: 'first?' });
    const second = open({ title: 'second?', confirmLabel: 'go' });
    await expect(first).resolves.toBe(false);
    expect(screen.queryByText('first?')).toBeNull();
    fireEvent.click(screen.getByText('go'));
    await expect(second).resolves.toBe(true);
  });
});

describe('useAlert', () => {
  it('shows one focused button and resolves when it is pressed', async () => {
    setup();
    let result!: Promise<void>;
    act(() => {
      result = tell({
        title: "couldn't delete that",
        message: 'try again',
        okLabel: 'got it',
      });
    });
    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(document.activeElement?.textContent).toBe('got it');
    fireEvent.click(screen.getByText('got it'));
    await expect(result).resolves.toBeUndefined();
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });
});
