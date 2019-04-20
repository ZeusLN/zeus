import * as React from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
import { Button } from 'react-native-elements';
import FeeUtils from './../utils/FeeUtils';
import FeeStore from './../stores/FeeStore';
import { Cell, Header, Row } from 'react-native-data-table';
import { isEmpty } from 'lodash';

interface FeeTableProps {
    feeStore: FeeStore;
    dataFrame: any;
    copyText?: string;
    loading: boolean;
    setFee: (value: string) => void;
}

interface FeeTableState {
    collapsed: boolean;
}

export default class FeeTable extends React.Component<FeeTableProps, FeeTableState> {
    state = {
        collapsed: true
    }

    styler(x: number|string) {
        if(x == null || typeof x === 'string') {
            return {
                "backgroundColor": "white",
                "height": 53,
                "minWidth": 53
            }
        };

        const c: any = FeeUtils.gcolor(x/800);

        return {
            "backgroundColor": `hsl(${c[0]}, ${c[1]*100}%, ${c[2]*100}%)`,
            "alignItems": "center",
            "height": 53,
            "minWidth": 53
        };
    }

    repr = (x: number) => Math.exp(x/100).toFixed(1);

    reprColumn = (x: number) => (x * 100).toFixed(0) + '%';

    reprIndex = (x: number) => x / 6 + 'h';

    openTable = () => {
        const { feeStore } = this.props;
        feeStore.getFees();

        this.setState({
            collapsed: false
        });
    }

    closeTable = () => {
        this.setState({
            collapsed: true
        });
    }

    render() {
        const { collapsed } = this.state;
        const { dataFrame, loading, setFee } = this.props;

        const df = dataFrame;
        let headers: any;
        let rows: any;

        if (!isEmpty(df) && !loading) {
            headers = df.columns && df.columns.map((columnName: number, index: number) =>
                <Cell style={{ backgroundColor: 'white', minWidth: 53, height: 53 }} textStyle={{ color: 'black' }} key={`item-${index}`}>{this.reprColumn(columnName)}</Cell>
            );

            rows = df.index.map((index: number, i: number) => {
                const cells = df.data[i].map((cell: any, k: number) => {
                    const value = this.repr(cell);
                    return (
                        <TouchableOpacity key={`cell-${k}`} onPress={() => setFee(value)}><Cell style={this.styler(cell)}><Text style={{ color: 'white' }}>{value}</Text></Cell></TouchableOpacity>
                    );
                });

                const indexText = this.reprIndex(index);

                return (
                    <Row key={`row-${i}`}>
                        <Cell style={this.styler(indexText)}><Text style={{ color: 'black' }}>{indexText}</Text></Cell>
                        {cells}
                    </Row>
                );
            });
        }

        return (
            <React.Fragment>
                <Button
                    title={collapsed ? "What the Fee?" : "Hide Fee Table"}
                    icon={{
                        name: "view-module",
                        size: 25,
                        color: "white"
                    }}
                    containerStyle={{
                        marginBottom: 20,
                        width: 200,
                        alignSelf: "center"
                    }}
                    buttonStyle={{
                        backgroundColor: "black",
                        borderRadius: 30
                    }}
                    onPress={() => collapsed ? this.openTable() : this.closeTable()}
                />
                {!collapsed && loading && <ActivityIndicator size="large" color="#0000ff" />}
                {!collapsed && !loading && headers && <View style={{ marginLeft: -53 }}>
                    <Header style={{ backgroundColor: 'white', paddingLeft: 66 }} textStyle={{ alignItems: 'center' }}>
                        {headers}
                    </Header>
                    {rows}
                </View>}
            </React.Fragment>
        );
    }
}