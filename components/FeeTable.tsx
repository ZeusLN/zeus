import * as React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Button } from 'react-native-elements';
import FeeUtils from './../utils/FeeUtils';
import FeeStore from './../stores/FeeStore';
import { Cell, DataTable, Header, HeaderCell, Row } from 'react-native-data-table';
import { isEmpty } from 'lodash';

interface FeeTableProps {
    feeStore: FeeStore;
    dataFrame: any;
    copyText?: string;
    loading: boolean;
    setFee: func;
}

interface FeeTableState {
    collapsed: boolean;
}

export default class FeeTable extends React.Component<FeeTableProps, FeeTableState> {
    state = {
        collapsed: true
    }

    styler(x) {
        if(x == null || isNaN(x)) {
            return {
                "background": "grey",
                "textAlign": "center",
                "border": `1px solid rgba(255,255,255,0.5)`
            }
        };

        const c = FeeUtils.gcolor(x/800);

        return {
            "backgroundColor": `hsl(${c[0]}, ${c[1]*100}%, ${c[2]*100}%)`,
            "alignItems": "center",
            "height": 55
        };
    }

    repr(x) {
        if(x == null || isNaN(x)) {
            return "NaN";
        }

        const approx: string = Math.exp(x/100);
        let r: string;

        r = Math.exp(x/100).toFixed(1);

        return r;
    }

    reprColumn(x: number) {
        return (x * 100).toFixed(0) + '%';
    }

    reprIndex(x: number) {
        return x / 6 + 'h';
    }

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
        const { feeStore, dataFrame, loading, setFee } = this.props;

        const df = dataFrame;
        let headers: any;
        let rows: any;

        if (!isEmpty(df) && !loading) {
            headers = df.columns && df.columns.map((columnName: number, index: number) =>
                <Cell style={{ backgroundColor: 'white' }} width={60} textStyle={{ color: 'black' }} key={`item-${index}`}>{this.reprColumn(columnName)}</Cell>
            );

            rows = df.index.map((index: any, i: number) => {
                const cells = df.data[i].map((cell: any, k: number) => {
                    const value = this.repr(cell);
                    return (
                        <Cell key={`cell-${k}`} style={this.styler(cell)}><Text style={{ color: value === "NaN" ? 'black' : 'white' }} onPress={() => setFee(value)}>{value}</Text></Cell>
                    );
                });

                return (
                    <Row key={`row-${i}`}>
                        <Cell style={{ backgroundColor: 'white' }} textStyle={{ color: 'black' }}>{this.reprIndex(index)}</Cell>
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
                {!collapsed && !loading && headers && <View style={{ width: 360 }}>
                    <Header style={{ paddingLeft: 60, backgroundColor: 'white' }}>
                        {headers}
                    </Header>
                    {rows}
                </View>}
            </React.Fragment>
        );
    }
}