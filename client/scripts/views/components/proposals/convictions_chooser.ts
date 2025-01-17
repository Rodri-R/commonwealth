import 'components/proposals/convictions_chooser.scss';

import m from 'mithril';
import { CustomSelect } from 'construct-ui';

import {
  convictionToWeight,
  convictionToLocktime,
  convictions,
} from 'controllers/chain/substrate/democracy_referendum';

const ConvictionsChooser: m.Component<{ callback: (number) => void }, {}> = {
  view: (vnode) => {
    return m(CustomSelect, {
      class: 'ConvictionsChooser',
      name: 'convictions',
      oncreate: () => {
        vnode.attrs.callback(convictions()[0].toString());
      },
      defaultValue: convictions()[0].toString(),
      options: convictions().map((c) => ({
        value: c.toString(),
        label: `${convictionToWeight(
          c
        )}x weight (locked for ${convictionToLocktime(c)}x enactment period)`,
      })),
      onSelect: (option) => {
        vnode.attrs.callback(parseInt((option as any).value, 10));
      },
    });
  },
};

export default ConvictionsChooser;
