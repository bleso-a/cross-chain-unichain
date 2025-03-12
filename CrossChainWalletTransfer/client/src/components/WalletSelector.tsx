import { CHAIN_NAMES, SUPPORTED_CHAINS } from '@/lib/constants';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { type Blockchain } from '@shared/types';

interface WalletSelectorProps {
  value: Blockchain;
  onChange: (value: Blockchain) => void;
  exclude?: Blockchain[];
  label?: string;
}

export function WalletSelector({ value, onChange, exclude = [], label }: WalletSelectorProps) {
  return (
    <div className="space-y-2">
      {label && <label className="text-sm font-medium">{label}</label>}
      <Select value={value} onValueChange={onChange as any}>
        <SelectTrigger>
          <SelectValue>{CHAIN_NAMES[value]}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {SUPPORTED_CHAINS
            .filter(chain => !exclude.includes(chain))
            .map(chain => (
              <SelectItem key={chain} value={chain}>
                {CHAIN_NAMES[chain]}
              </SelectItem>
            ))
          }
        </SelectContent>
      </Select>
    </div>
  );
}
