export interface SetListTrack {
  bufferId: string;
  title: string;
  duration: number;
}

export interface SetListRecord {
  id: string;
  name: string;
  tracks: SetListTrack[];
}
