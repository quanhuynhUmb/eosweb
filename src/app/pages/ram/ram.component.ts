import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { MatPaginator, MatTableDataSource, MatSort } from '@angular/material';
import * as moment from 'moment';
import * as shape from 'd3-shape';
import { Socket } from 'ng-socket-io';
import { NotificationsService } from 'angular2-notifications';
import { MainService } from '../../services/mainapp.service';

@Component({
  selector: 'ram-page',
  templateUrl: './ram.component.html',
  styleUrls: ['./ram.component.css']
})
export class RamPageComponent implements OnInit{
  mainData;
  spinner = false;
  displayedColumns = ['Tx', 'Type', 'Price', 'Amount', 'Date'];
  dataSource;
  eosToInt = Math.pow(10, 13);
  ramPrice;
  globalStat;
  curve = shape.curveMonotoneX;
  moment = moment;

  ngxChartOptions = {
      colorScheme : {
          domain: ['#44a264']
      },
      view : [900, 400],
      showXAxis : true,
      showYAxis : true,
      gradient : true,
      showLegend : false,
      showXAxisLabel : false,
      xAxisLabel : 'EOS',
      showYAxisLabel : true,
      yAxisLabel : 'EOS',
      autoScale : true,
      timeline: true,
      fitContainer : true
  }; 
  mainCurrencyChartDataRes;
  WINDOW: any = window;
  eosNetwork = {
            blockchain: 'eos',
            host: '',
            port: '',
            chainId: "aca376f206b8fc25a6ed44dbdc66547c36c6c33e3a119ffbeaef943642f0e906",
  };
  eosOptions = {
            broadcast: true,
            sign: true,
            chainId: "aca376f206b8fc25a6ed44dbdc66547c36c6c33e3a119ffbeaef943642f0e906"
  };
  protocol = 'https';
  identity;
  balance;
  unstaked;
  buyRAM = {
    eos: 0,
    kb : 0
  };
  sellRAM = {
    eos: 0,
    kb : 0
  };
  donation;
  orderHistory;
  defaultTimeName = 'Day';
  timeArray = ['Week', 'Month'];
  dateFrom = new Date(+new Date() - 24 * 60 * 60 * 1000);
  ScatterJS;
  eos;
  frontConfig = {
      coin: 'EOS'
  };
  options = { authorization: [''] };

  constructor(private route: ActivatedRoute, 
              protected http: HttpClient, 
              private socket: Socket,
              private notifications: NotificationsService,
              private MainService: MainService){
    this.WINDOW.ScatterJS.plugins(new this.WINDOW.ScatterEOS());
  }

  getGlobal(){
      this.http.get(`/api/v1/get_table_rows/eosio/eosio/global/10`)
          .subscribe((res: any) => {
                          if (!res || !res.rows){
                              return console.error('data error', res);
                          }
                          this.globalStat = res.rows[0];
                      },
                      (error) => {
                          console.error(error);
                      });
  }

  getWalletAPI(){
       this.http.get(`/api/v1/get_wallet_api`)
          .subscribe((res: any) => {
                          this.eosNetwork.host = res.host;
                          this.eosNetwork.port = res.port;
                          this.eosNetwork.chainId = res.chainId;
                          this.protocol = res.protocol;
                          if (localStorage.getItem("scatter") === 'loggedIn'){
                                if (!this.WINDOW.ScatterJS){
                                     document.addEventListener('scatterLoaded', () => {
                                           this.loginScatter();
                                     });
                                } else {
                                  this.loginScatter();
                                }
                          }
                      },
                      (error) => {
                          console.error(error);
                      });
  }

  getChart(dateFrom) {
    this.spinner = true;
        this.http.post(`/api/v1/get_chart_ram`, { from: dateFrom } )
                  .subscribe(
                      (res: any) => {
                           this.mainCurrencyChartDataRes = this.createChartArr(res);
                           this.spinner = false;
                      },
                      (error) => {
                          console.error(error);
                      });
  }

  createChartArr(data){
    let result = [];
      data.forEach(elem => {
          let quoteBalance  = Number(elem.quote.split(' ')[0]);
          let baseBalance   = Number(elem.base.split(' ')[0]);
          result.push({ name: new Date(elem.date), value: (quoteBalance / baseBalance * 1024).toFixed(8) });
      });
    return result;
  }

  selectDay(name){
      this.timeArray.push(this.defaultTimeName);
      this.timeArray.splice(this.timeArray.indexOf(name), 1);
      this.defaultTimeName = name;
      let date;
      if (name === 'Day'){
          date = +new Date() - 24 * 3600000;
      } else if (name === 'Week'){
          date = +new Date() - 7 * 24 * 3600000;
      } else if (name === 'Month'){
          date = +new Date() - 30 * 7 * 24 * 3600000;
      }
      this.getChart(date);
  }

  getRam(){
      this.http.get(`/api/v1/get_table_rows/eosio/eosio/rammarket/10`)
          .subscribe((res: any) => {
                          this.countRamPrice(res);
                      },
                      (error) => {
                          console.error(error);
                      });
  }

  countRamPrice(res){
        if (!res || !res.rows || !res.rows[0] || !res.rows[0].quote || !res.rows[0].base){
                return console.error('data error', res);
        }
        let data = res.rows[0];
        let quoteBalance  = Number(data.quote.balance.split(' ')[0]);
        let baseBalance   = Number(data.base.balance.split(' ')[0]);
        this.ramPrice = (quoteBalance / baseBalance * 1024).toFixed(5);
  }

  getAccount(name){
      this.spinner = true;
      this.http.get(`/api/v1/get_account/${name}`)
           .subscribe((res: any) => {
                          this.mainData = res;
                          this.getBalance(name);
                          this.spinner = false;
                      },
                      (error) => {
                          console.error(error);
                          this.spinner = false;
                      });
  }

  getBalance(accountId){
      this.http.get(`/api/v1/get_currency_balance/eosio.token/${accountId}/EOS`)
           .subscribe((res: any) => {
                          this.unstaked = (!res[0]) ? 0 : Number(res[0].split(' ')[0]); 
                          let staked = 0;
                          if (this.mainData.voter_info && this.mainData.voter_info.staked){
                              staked = this.mainData.voter_info.staked;
                          }
                          this.balance = this.unstaked + staked / 10000;
                      },
                      (error) => {
                          console.error(error);
                      });
  }

  buyChangeEOS(e) {
      this.buyRAM.kb = this.buyRAM.eos / this.ramPrice;
  }
  buyChangeKB(e) {
      this.buyRAM.eos = this.ramPrice * this.buyRAM.kb;
  }
  sellChangeEOS(e) {
      this.sellRAM.kb = this.sellRAM.eos / this.ramPrice;
  }
  sellChangeKB(e) {
      this.sellRAM.eos = this.ramPrice * this.sellRAM.kb;
  }

  loginScatter(){
    if (!this.WINDOW.ScatterJS){
        return this.notifications.error('Scatter error', 'Please install Scatter extension');
    }
    localStorage.setItem("scatter", 'loggedIn');
    this.WINDOW.ScatterJS.scatter.connect('EOSweb').then(connected => {
        if(!connected) {
          return this.notifications.error('Scatter error', 'Can\'t connect to Scatter');
        } 
      
        this.ScatterJS = this.WINDOW.ScatterJS.scatter;
        this.WINDOW.scatter = null;

        this.eos = this.ScatterJS.eos(this.eosNetwork, this.WINDOW.Eos, this.eosOptions, this.protocol);

        this.ScatterJS.getIdentity({
           accounts: [this.eosNetwork]
        }).then(identity => {
            if (identity.accounts.length === 0) {
                return;
            }
            let objectIdentity;
            if (this.ScatterJS.identity && this.ScatterJS.identity.accounts){
               objectIdentity = this.ScatterJS.identity.accounts.find(x => x.blockchain === 'eos');
            }
            objectIdentity = { name: identity.accounts[0].name };
             //identity.accounts[0].name;
            this.identity = (objectIdentity && objectIdentity.name) ? objectIdentity.name : null;
            if (this.identity){
                this.getAccount(this.identity);
                this.getOrderHistory(this.identity);
            }
            this.options.authorization = [this.identity];
        }).catch(err => {
            console.error(err);
        });
    });
  }

  logoutScatter(){
    if (!this.ScatterJS){
        return this.notifications.error('Scatter error', 'Please install Scatter extension');
    }
    localStorage.setItem("scatter", 'loggedOut');
    this.ScatterJS.forgetIdentity().then(() => {
        location.reload();
        this.notifications.success('Logout success', '');
    }).catch(err => {
        console.error(err);
    });
  }

  funcBuyRAM(quantity) {
    if(!this.identity){
        return console.error('Identity error!!!');
    }
    if ( isNaN(Number(quantity)) ){
          return console.error('Amount must be a number!');
    }
        let amount = parseFloat(`${quantity}`).toFixed(4);
        let requiredFields = {
            accounts: [this.eosNetwork]
        }
        this.eos.contract('eosio', {
            requiredFields
        }).then(contract => {
            contract.buyram({
                payer: this.identity,
                receiver: this.identity,
                quant: `${amount} EOS`
            }, this.options).then(trx => {
                 console.log(trx);
                 this.saveOrder({ amount: this.buyRAM.kb * 1024, account: this.identity, type: 'buy', tx_id: trx.transaction_id, price: this.ramPrice });
                 this.getAccount(this.identity);
                 this.buyRAM = {
                     eos: 0,
                     kb: 0
                 };
                 this.notifications.success('Transaction Success', '');
                 this.notifications.success('Donation', 'Support our project, make a donation :)');
            }).catch(err => {
                 console.error(err);
                 this.notifications.error('Transaction Fail', '');
            });  
        }).catch(err => {
            console.error(err);
            this.notifications.error('Transaction Fail', '');
        });
  }

  funcSellRAM(quantity){
    if(!this.identity){
        return console.error('Identity error!!!');
    }
        let amount = Number(quantity);
        if (isNaN(amount)){
          return console.error('Amount must be a number!');
        }
        amount = parseInt(`${amount * 1024}`); 
        let requiredFields = {
            accounts: [this.eosNetwork]
        }
        this.eos.contract('eosio', {
            requiredFields
        }).then(contract => {
            contract.sellram({
                account: this.identity,
                bytes: amount
            }, this.options).then(trx => {
                 console.log(trx);
                 this.saveOrder({ amount: amount, account: this.identity, type: 'sell', tx_id: trx.transaction_id, price: this.ramPrice });
                 this.getAccount(this.identity);
                 this.sellRAM = {
                     eos: 0,
                     kb: 0
                 };
                 this.notifications.success('Transaction Success', '');
                 this.notifications.success('Donation', 'Support our project, make a donation :)');
            }).catch(err => {
                 console.error(err);
                 this.notifications.error('Transaction Fail', '');
            });  
        });
  }

  funcDonation(quantity){
    if(!this.identity){
        return console.error('Identity error!!!');
    }
        let amount = Number(`${this.donation}`).toFixed(4);
        this.eos.transfer(this.identity, 'eoswebnetbp1', `${amount} EOS`, 'Donation', this.options)
           .then(result => {
                console.log(result);
                this.getAccount(this.identity);
                this.notifications.success('Transaction Success', '');
                this.notifications.success('Donation', 'Thanks for donation :)');
                this.donation = 0;
           }).catch(err => {
                console.error(err);
                this.notifications.error('Transaction Fail', '');
           });  
  }


  saveOrder(data){
        this.http.post('/api/v1/ram_order', data)
            .subscribe((res: any) => {
                  this.getAccount(this.identity);
                  this.getOrderHistory(this.identity);
            },
            (err: any) => {
                  console.error(err);
            });
  }  


  getOrderHistory(account){
      this.http.get('/api/v1/ram_orders/' + account)
            .subscribe((res: any) => {
                  this.orderHistory = res;
                  let ELEMENT_DATA: Element[] = res;
                  this.dataSource = new MatTableDataSource<Element>(ELEMENT_DATA);
            },
            (err: any) => {
                  console.error(err);
            });
  }

  parseNumber(number) {
      if (!number){
        return 0;
      }
      return parseFloat(number).toFixed(4);
  }

  
  ngOnInit() {
     this.getGlobal();
     this.getRam();
     this.getChart(this.dateFrom);
     this.getWalletAPI();

     this.socket.on('get_ram', res => {
          this.countRamPrice(res);
     });
     if (localStorage.getItem('frontConf')){
          this.frontConfig = JSON.parse(localStorage.getItem('frontConf'));
     }
  }
}







