import { useLocalSearchParams } from 'expo-router';
import { StakingDealForm } from '@/components/StakingDealForm';

export default function EditStakingDeal() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <StakingDealForm mode="edit" dealId={id} />;
}
