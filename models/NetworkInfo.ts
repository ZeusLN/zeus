import BaseModel from './BaseModel';

export default class NetworkInfo extends BaseModel {
    graph_diameter: number;
    avg_out_degree: number;
    max_out_degree: number;
    num_nodes: number;
    num_channels: number;
    total_network_capacity: string;
    avg_channel_size: number;
    min_channel_size: string;
    max_channel_size: string;
    median_channel_size_sat: string;
    num_zombie_chans: string;
}
